// Simple in-memory rate limiting (resets on deploy/restart)
// For production, use Vercel KV or Redis
const rateLimitMap = new Map();
const DAILY_LIMIT = 200; // requests per day
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

function checkRateLimit() {
  const now = Date.now();
  const today = new Date().toDateString();
  
  if (!rateLimitMap.has(today)) {
    // Clear old entries
    rateLimitMap.clear();
    rateLimitMap.set(today, { count: 0, resetAt: now + RATE_LIMIT_WINDOW });
  }
  
  const limit = rateLimitMap.get(today);
  
  if (limit.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  limit.count++;
  return { allowed: true, remaining: DAILY_LIMIT - limit.count };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check rate limit
  const rateLimit = checkRateLimit();
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
  
  if (!rateLimit.allowed) {
    return res.status(429).json({ 
      error: 'Daily limit reached. Come back tomorrow!',
      message: 'Movie Night has reached its daily recommendation limit. Please try again tomorrow.'
    });
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
    // Call Anthropic API - Using Haiku for speed (3x faster, 10x cheaper)
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // Faster model
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

    // Helper function to search TMDB with different strategies
    const searchTMDB = async (rec) => {
      const searchType = rec.type === 'series' ? 'tv' : 'movie';
      const year = rec.year;
      
      // Try multiple search strategies in order
      const searchStrategies = [
        rec.title,                                    // Just title
        `${rec.title} ${year}`,                       // Title + year
        rec.tmdb_query,                               // Claude's suggested query
        rec.title.replace(/[:\-–—]/g, ' '),          // Title without punctuation
      ].filter(Boolean);
      
      for (const query of searchStrategies) {
        try {
          // First try with year filter
          let url = `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
          if (year && !query.includes(year)) {
            url += `&year=${year}`;
          }
          
          const response = await fetch(url, {
            headers: {
              Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              // Try to find exact year match first
              const exactMatch = data.results.find(m => {
                const releaseYear = (m.release_date || m.first_air_date || '').split('-')[0];
                return releaseYear === year;
              });
              return exactMatch || data.results[0];
            }
          }
          
          // If year filter returned nothing, try without year
          if (year) {
            const responseNoYear = await fetch(
              `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}`,
                  'Content-Type': 'application/json',
                },
              }
            );
            
            if (responseNoYear.ok) {
              const dataNoYear = await responseNoYear.json();
              if (dataNoYear.results && dataNoYear.results.length > 0) {
                return dataNoYear.results[0];
              }
            }
          }
        } catch (e) {
          console.error(`TMDB search failed for "${query}":`, e);
        }
      }
      
      return null;
    };

    // Fetch TMDB data for all recommendations IN PARALLEL (faster)
    const recommendationsWithData = await Promise.all(
      result.recommendations.map(async (rec) => {
        try {
          const movie = await searchTMDB(rec);
          
          if (movie) {
            const encodedTitle = encodeURIComponent(rec.title);
            
            return {
              ...rec,
              poster_path: movie.poster_path,
              backdrop_path: movie.backdrop_path,
              tmdb_id: movie.id,
              tmdb_rating: movie.vote_average ? movie.vote_average.toFixed(1) : null,
              links: {
                imdb: `https://www.imdb.com/find/?q=${encodedTitle}`,
                rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodedTitle}`,
                letterboxd: `https://letterboxd.com/search/${encodedTitle}/`,
                justWatch: `https://www.justwatch.com/us/search?q=${encodedTitle}`,
              }
            };
          }
        } catch (e) {
          console.error('TMDB fetch error:', e);
        }
        
        // Fallback with just links if TMDB fails
        const encodedTitle = encodeURIComponent(rec.title);
        return {
          ...rec,
          links: {
            imdb: `https://www.imdb.com/find/?q=${encodedTitle}`,
            rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodedTitle}`,
            letterboxd: `https://letterboxd.com/search/${encodedTitle}/`,
            justWatch: `https://www.justwatch.com/us/search?q=${encodedTitle}`,
          }
        };
      })
    );

    return res.status(200).json({
      recommendations: recommendationsWithData,
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
