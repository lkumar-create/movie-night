export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { preferences, mode } = req.body;

  if (!preferences || preferences.length === 0) {
    return res.status(400).json({ error: 'No preferences provided' });
  }

  const isBadMovieMode = mode === 'bad';

  const systemPrompt = isBadMovieMode
    ? `You are a connoisseur of gloriously terrible cinema. You love movies that are so bad they're good — the kind you watch with friends to laugh at, not with.

Someone wants bad movie recommendations. Here's what they said:
${preferences.join('\n')}

Provide exactly 4 recommendations of entertainingly awful films. Respond in this exact JSON format:
{
  "recommendations": [
    {
      "title": "Exact Film Title",
      "year": "2003",
      "director": "Director Name",
      "type": "film",
      "genre": "Action",
      "runtime": "1h 45m",
      "logline": "A delightfully unhinged premise delivered with zero self-awareness.",
      "why": "One sentence on why this is perfect for a bad movie night.",
      "trust": "12% on Rotten Tomatoes. A masterpiece of trash cinema.",
      "tmdb_query": "film title for search"
    }
  ]
}

Pick films that are FUN to watch ironically — not boring-bad, but entertaining-bad. Think Nicolas Cage weird choices, absurd action films, so-bad-it's-quotable dialogue. Cult classics welcome.`
    : `You are a refined film curator with impeccable taste. You draw from global cinema — Hollywood, Bollywood, Korean, French, Japanese, Nigerian, Iranian, Latin American, and beyond. You recommend based on quality, not familiarity. Your picks reflect diverse voices, perspectives, and talent from around the world.

Someone is planning their movie night and needs recommendations. Here's what they said:
${preferences.join('\n')}

Provide exactly 4 recommendations that match their vibe. Respond in this exact JSON format:
{
  "recommendations": [
    {
      "title": "Exact Film or Series Title",
      "year": "2023",
      "director": "Director Name",
      "type": "film or series",
      "genre": "Primary Genre",
      "runtime": "2h 15m or 8 episodes",
      "logline": "A single compelling sentence that captures the essence without spoilers.",
      "why": "One sentence explaining why this fits their mood, written with taste and specificity.",
      "trust": "A short trust signal — could be Rotten Tomatoes score, festival wins, cultural moment, or critical acclaim. One line.",
      "tmdb_query": "film title for search"
    }
  ]
}

Curate thoughtfully:
- Mix classics with contemporary
- At least one non-English language film (don't mention this explicitly)
- Actively include films by and about underrepresented groups: directors and actors of color, women filmmakers, LGBTQ+ stories, disability representation — this should feel natural, never tokenizing
- At least one hidden gem they likely haven't seen
- Prioritize quality over popularity
- Never recommend generic blockbusters unless they specifically fit
- Surface extraordinary stories from voices often overlooked by mainstream algorithms`;

  try {
    // Call Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const error = await anthropicResponse.text();
      console.error('Anthropic API error:', error);
      return res.status(500).json({ error: 'Failed to get recommendations' });
    }

    const anthropicData = await anthropicResponse.json();
    const text = anthropicData.content?.map((c) => c.text || '').join('') || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(500).json({ error: 'Failed to parse recommendations' });
    }

    const result = JSON.parse(jsonMatch[0]);

    // Fetch TMDB data for each recommendation
    const recommendationsWithPosters = await Promise.all(
      result.recommendations.map(async (rec) => {
        try {
          const searchQuery = rec.tmdb_query || rec.title;
          const tmdbResponse = await fetch(
            `https://api.themoviedb.org/3/search/${rec.type === 'series' ? 'tv' : 'movie'}?query=${encodeURIComponent(searchQuery)}&include_adult=false&language=en-US&page=1`,
            {
              headers: {
                Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (tmdbResponse.ok) {
            const tmdbData = await tmdbResponse.json();
            if (tmdbData.results && tmdbData.results.length > 0) {
              const movie = tmdbData.results[0];
              return {
                ...rec,
                poster_path: movie.poster_path,
                backdrop_path: movie.backdrop_path,
                tmdb_id: movie.id,
              };
            }
          }
        } catch (e) {
          console.error('TMDB fetch error:', e);
        }
        return rec;
      })
    );

    return res.status(200).json({
      recommendations: recommendationsWithPosters,
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
