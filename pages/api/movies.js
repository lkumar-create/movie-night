export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ids } = req.query;

  if (!ids) {
    return res.status(400).json({ error: 'No movie IDs provided' });
  }

  const idList = ids.split(',').map(id => id.trim()).filter(Boolean);

  if (idList.length === 0) {
    return res.status(400).json({ error: 'Invalid movie IDs' });
  }

  try {
    const moviePromises = idList.map(async (idString) => {
      // Parse type prefix: "tv:12345" means TV show, otherwise movie
      let type = 'movie';
      let tmdbId = idString;
      
      if (idString.startsWith('tv:')) {
        type = 'tv';
        tmdbId = idString.slice(3);
      }
      
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/${type}/${tmdbId}?append_to_response=credits`,
          {
            headers: {
              Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          // If movie fails and no prefix was given, try TV
          if (type === 'movie') {
            const tvResponse = await fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}?append_to_response=credits`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            if (tvResponse.ok) {
              const data = await tvResponse.json();
              return formatResult(data, 'tv');
            }
          }
          console.error(`TMDB fetch failed for ID ${tmdbId}`);
          return null;
        }

        const data = await response.json();
        return formatResult(data, type);
      } catch (e) {
        console.error(`Error fetching ${type} ${tmdbId}:`, e);
        return null;
      }
    });

    const movies = (await Promise.all(moviePromises)).filter(Boolean);

    if (movies.length === 0) {
      return res.status(404).json({ error: 'No movies found' });
    }

    return res.status(200).json({ movies });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Failed to fetch movies' });
  }
}

function formatResult(data, type) {
  const title = data.title || data.name;
  const releaseDate = data.release_date || data.first_air_date;
  const director = data.credits?.crew?.find(c => c.job === 'Director')?.name || 
                 data.created_by?.[0]?.name || 'Unknown';
  const runtime = data.runtime 
    ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m`
    : data.episode_run_time?.[0] 
      ? `${data.episode_run_time[0]}m episodes`
      : data.number_of_episodes
        ? `${data.number_of_episodes} episodes`
        : 'Unknown';
  const genres = data.genres?.map(g => g.name).slice(0, 2).join(' / ') || 'Film';
  const encodedTitle = encodeURIComponent(title);

  return {
    title,
    year: releaseDate?.split('-')[0] || 'Unknown',
    director,
    genre: genres,
    runtime,
    tmdb_id: data.id,
    type: type,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    overview: data.overview,
    links: {
      imdb: data.imdb_id ? `https://www.imdb.com/title/${data.imdb_id}` : `https://www.imdb.com/find/?q=${encodedTitle}`,
      rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodedTitle}`,
      letterboxd: `https://letterboxd.com/search/${encodedTitle}/`,
      justWatch: `https://www.justwatch.com/us/search?q=${encodedTitle}`
    }
  };
}
