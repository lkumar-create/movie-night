// Requires: npm install @vercel/kv
// Then in Vercel: Storage tab -> Create Database -> KV -> Connect to this project
// (this auto-adds KV_REST_API_URL and KV_REST_API_TOKEN env vars, no manual setup needed)
import { kv } from '@vercel/kv';

const DAILY_LIMIT = 80; // tightened from 200 to match realistic traffic
const ALLOWED_ORIGIN = 'thismovienight.com';

async function checkRateLimit() {
  const today = new Date().toISOString().slice(0, 10); // e.g. "2026-08-27"
  const key = `ratelimit:${today}`;

  // Increment persists across serverless cold starts (unlike an in-memory Map)
  const count = await kv.incr(key);

  // Set expiry only on the first request of the day so the key cleans itself up
  if (count === 1) {
    await kv.expire(key, 60 * 60 * 24); // 24 hours
  }

  return {
    allowed: count <= DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - count),
  };
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin || '';
  const referer = req.headers.referer || '';
  return origin.includes(ALLOWED_ORIGIN) || referer.includes(ALLOWED_ORIGIN);
}

function isValidBody(body) {
  const { preferences } = body || {};
  if (!Array.isArray(preferences)) return false;
  if (preferences.length === 0 || preferences.length > 10) return false;
  if (!preferences.every((p) => typeof p === 'string' && p.length <= 500)) return false;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject requests that didn't come from the actual site (blocks direct/bot hits)
  if (!isAllowedOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!isValidBody(req.body)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  // Check rate limit (now backed by Vercel KV, works across all instances)
  let rateLimit;
  try {
    rateLimit = await checkRateLimit();
  } catch (e) {
    console.error('Rate limit check failed:', e);
    // Fail open but log it — don't take the whole site down if KV has a hiccup
    rateLimit = { allowed: true, remaining: DAILY_LIMIT };
  }

  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);

  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: 'Daily limit reached. Come back tomorrow!',
      message: 'Movie Night has reached its daily recommendation limit. Please try again tomorrow.',
    });
  }

  const { preferences, mode } = req.body;
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
      const titleLower = rec.title.toLowerCase().trim();

      const isTitleMatch = (result) => {
        const resultTitle = (result.title || result.name || '').toLowerCase().trim();
        return resultTitle === titleLower ||
               resultTitle.includes(titleLower) ||
               titleLower.includes(resultTitle);
      };

      const isYearMatch = (result) => {
        if (!year) return true;
        const releaseYear = parseInt((result.release_date || result.first_air_date || '').split('-')[0]);
        const targetYear = parseInt(year);
        return Math.abs(releaseYear - targetYear) <= 1;
      };

      const searchStrategies = [
        rec.title,
        rec.tmdb_query,
        rec.title.replace(/[:\-–—]/g, ' '),
      ].filter(Boolean);

      for (const query of searchStrategies) {
        try {
          let url = `https://api.themoviedb.org/3/search/${searchType}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
          if (year) {
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
              const bestMatch = data.results.find(m => isTitleMatch(m) && isYearMatch(m));
              if (bestMatch) return bestMatch;

              if (year && data.results[0] && isTitleMatch(data.results[0])) {
                return data.results[0];
              }
            }
          }

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
              const match = dataNoYear.results.find(m => isTitleMatch(m) && isYearMatch(m));
              if (match) return match;
            }
          }
        } catch (e) {
          console.error(`TMDB search failed for "${query}":`, e);
        }
      }

      return null;
    };

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
