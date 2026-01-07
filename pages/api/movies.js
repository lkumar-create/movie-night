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
    const moviePromises = idList.map(async (tmdbId) => {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits`,
          {
            headers: {
              Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!res.ok) {
          console.error(`TMDB fetch failed for ID ${tmdbId}:`, res.status);
          return null;
        }

        const movie = await res.json();
        const director = movie.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
        const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'Unknown';
        const genres = movie.genres?.map(g => g.name).slice(0, 2).join(' / ') || 'Film';
        const encodedTitle = encodeURIComponent(movie.title);

        return {
          title: movie.title,
          year: movie.release_date?.split('-')[0] || 'Unknown',
          director,
          genre: genres,
          runtime,
          tmdb_id: movie.id,
          poster_path: movie.poster_path,
          backdrop_path: movie.backdrop_path,
          overview: movie.overview,
          links: {
            imdb: movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : `https://www.imdb.com/find/?q=${encodedTitle}`,
            rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodedTitle}`,
            letterboxd: `https://letterboxd.com/search/${encodedTitle}/`,
            justWatch: `https://www.justwatch.com/us/search?q=${encodedTitle}`
          }
        };
      } catch (e) {
        console.error(`Error fetching movie ${tmdbId}:`, e);
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
