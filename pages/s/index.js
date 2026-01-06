import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

// Decade color tints
const DECADE_COLORS = {
  1920: { overlay: 'rgba(112, 66, 20, 0.35)' },
  1930: { overlay: 'rgba(180, 140, 60, 0.25)' },
  1940: { overlay: 'rgba(30, 40, 80, 0.3)' },
  1950: { overlay: 'rgba(0, 140, 140, 0.2)' },
  1960: { overlay: 'rgba(200, 100, 30, 0.2)' },
  1970: { overlay: 'rgba(120, 110, 50, 0.25)' },
  1980: { overlay: 'rgba(200, 50, 200, 0.2)' },
  1990: { overlay: 'rgba(0, 100, 100, 0.15)' },
  2000: { overlay: 'rgba(70, 90, 120, 0.15)' },
  2010: { overlay: 'rgba(30, 80, 100, 0.12)' },
  2020: { overlay: 'rgba(201, 169, 98, 0.1)' },
};

function getDecadeColor(year) {
  if (!year) return DECADE_COLORS[2020];
  const y = parseInt(year);
  const decade = Math.floor(y / 10) * 10;
  return DECADE_COLORS[decade] || DECADE_COLORS[2020];
}

export default function SharedByUrl() {
  const router = useRouter();
  const { ids, d } = router.query; // ids = TMDB IDs, d = display data (encoded JSON with why, trust, logline)

  const [recommendations, setRecommendations] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch movie details from TMDB
  useEffect(() => {
    if (!ids) return;

    const fetchMovies = async () => {
      try {
        const idList = ids.split(',').map(id => id.trim()).filter(Boolean);
        
        if (idList.length === 0) {
          setError('No movies specified.');
          setIsLoading(false);
          return;
        }

        // Parse display data if provided
        let displayData = [];
        if (d) {
          try {
            displayData = JSON.parse(decodeURIComponent(d));
          } catch (e) {
            console.error('Failed to parse display data:', e);
          }
        }

        // Fetch each movie from TMDB
        const TMDB_API_KEY = '2aa266e462e73f31d49cce3017e105e4';
        
        const moviePromises = idList.map(async (tmdbId, idx) => {
          const res = await fetch(
            `https://api.tmdb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
          );
          
          if (!res.ok) return null;
          
          const movie = await res.json();
          const director = movie.credits?.crew?.find(c => c.job === 'Director')?.name || 'Unknown';
          const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : 'Unknown';
          const genres = movie.genres?.map(g => g.name).slice(0, 2).join(' / ') || 'Film';
          
          // Use display data if available
          const dd = displayData[idx] || {};
          
          return {
            title: movie.title,
            year: movie.release_date?.split('-')[0] || 'Unknown',
            director,
            genre: genres,
            runtime,
            logline: dd.l || movie.overview || 'No description available.',
            why: dd.w || 'A great film worth watching.',
            trust: dd.t || '',
            tmdb_id: movie.id,
            poster_path: movie.poster_path,
            backdrop_path: movie.backdrop_path,
            links: {
              imdb: `https://www.imdb.com/title/${movie.imdb_id || ''}`,
              rottenTomatoes: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(movie.title)}`,
              letterboxd: `https://letterboxd.com/search/${encodeURIComponent(movie.title)}/`,
              justWatch: `https://www.justwatch.com/us/search?q=${encodeURIComponent(movie.title)}`
            }
          };
        });

        const movies = (await Promise.all(moviePromises)).filter(Boolean);
        
        if (movies.length === 0) {
          setError('Could not load the shared movies.');
          setIsLoading(false);
          return;
        }

        setRecommendations(movies);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching movies:', err);
        setError('Failed to load recommendations.');
        setIsLoading(false);
      }
    };

    fetchMovies();
  }, [ids, d]);

  const currentRec = recommendations[activeIndex];
  const isVintageFilm = currentRec?.year && parseInt(currentRec.year) < 1990;
  const decadeColor = getDecadeColor(currentRec?.year);

  const backdropUrl = currentRec?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${currentRec.backdrop_path}`
    : null;

  const selectFilm = (index) => {
    setActiveIndex(index);
    setImageLoaded(false);
    setShowTrailer(false);
  };

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied!');
    } catch (err) {
      prompt('Copy this link:', window.location.href);
    }
  };

  return (
    <>
      <Head>
        <title>Movie Night — Shared Recommendations</title>
        <meta name="description" content="Check out these movie recommendations from Movie Night!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.png" />
      </Head>

      <div className="min-h-screen bg-black text-white">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500&display=swap');

          :root {
            --gold: #C9A962;
            --gold-light: #E5D4A1;
            --gold-dim: rgba(201, 169, 98, 0.6);
          }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #000;
          }

          .font-display {
            font-family: 'Playfair Display', Georgia, serif;
          }

          .deco-line-gradient {
            height: 1px;
            background: linear-gradient(90deg, var(--gold), var(--gold-dim), transparent);
          }

          .review-link {
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          .review-link:hover {
            opacity: 1;
          }

          .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }

          .film-grain {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 50;
            opacity: 0.04;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          }
        `}</style>

        {/* Film Grain */}
        {!isLoading && isVintageFilm && <div className="film-grain" />}

        {/* Decade Tint */}
        {!isLoading && currentRec && (
          <div 
            className="fixed inset-0 pointer-events-none z-10"
            style={{ backgroundColor: decadeColor.overlay }}
          />
        )}

        {/* Trailer Modal */}
        {showTrailer && currentRec && (
          <div 
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTrailer(false)}
          >
            <div className="relative w-full max-w-4xl aspect-video">
              <button
                onClick={() => setShowTrailer(false)}
                className="absolute -top-12 right-0 text-white/60 hover:text-white"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <iframe
                className="w-full h-full rounded-lg"
                src={`https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(currentRec.title + ' ' + currentRec.year + ' official trailer')}`}
                title="Trailer"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}

        {/* LOADING */}
        {isLoading && (
          <div className="h-screen flex flex-col items-center justify-center px-8">
            <p className="font-display text-2xl md:text-3xl italic" style={{ color: 'var(--gold)' }}>
              Loading shared recommendations...
            </p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="h-screen flex flex-col items-center justify-center px-8 text-center">
            <div className="text-6xl mb-6">🎬</div>
            <h2 className="font-display text-3xl mb-4" style={{ color: 'var(--gold)' }}>
              Oops!
            </h2>
            <p className="text-white/60 max-w-md mb-8">{error}</p>
            <a
              href="/"
              className="px-6 py-3 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--gold)', color: '#000' }}
            >
              Start your own Movie Night
            </a>
          </div>
        )}

        {/* RESULTS */}
        {!isLoading && !error && currentRec && (
          <div className="min-h-screen lg:flex lg:flex-row relative z-20">
            
            {/* Desktop sidebar */}
            <div className="hidden lg:flex flex-shrink-0 py-8 pr-8 pl-4 flex-col gap-3 overflow-y-auto w-44 h-screen order-2">
              {recommendations.map((rec, idx) => (
                <button
                  key={idx}
                  onClick={() => selectFilm(idx)}
                  className={`flex-shrink-0 rounded-lg overflow-hidden transition-all ${
                    idx === activeIndex 
                      ? 'ring-2 ring-offset-2 ring-offset-black opacity-100' 
                      : 'opacity-50 hover:opacity-80'
                  }`}
                  style={{ '--tw-ring-color': 'var(--gold)' }}
                >
                  <div className="w-full h-24 flex items-center justify-center p-3 text-center bg-zinc-900">
                    <span className="text-xs text-white/80 font-medium leading-tight line-clamp-3">
                      {rec.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Mobile: Netflix-style horizontal tabs */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-white/10">
              <div className="flex overflow-x-auto scrollbar-hide px-2">
                {recommendations.map((rec, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      selectFilm(idx);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className={`flex-shrink-0 py-3 px-4 transition-all border-b-2 ${
                      idx === activeIndex 
                        ? 'border-current' 
                        : 'border-transparent'
                    }`}
                    style={{ color: idx === activeIndex ? 'var(--gold)' : 'rgba(255,255,255,0.4)' }}
                  >
                    <span className="font-display text-xs whitespace-nowrap">
                      {rec.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col order-1 pb-16 lg:pb-0">
              
              {/* Background */}
              {backdropUrl && (
                <div className="fixed inset-0 lg:w-[calc(100%-11rem)] -z-10">
                  <img
                    src={backdropUrl}
                    alt=""
                    className={`w-full h-full object-cover transition-opacity duration-700 ${
                      imageLoaded ? 'opacity-40' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30" />
                </div>
              )}

              {/* Content */}
              <div className="relative flex-1 flex flex-col">
                
                {/* Top bar */}
                <div className="flex justify-between items-center px-6 py-4">
                  <a href="/" className="flex items-center gap-2 text-white/50 hover:text-white/80">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span className="text-sm">Make your own</span>
                  </a>
                  
                  <button
                    onClick={copyCurrentUrl}
                    className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    Share
                  </button>
                </div>

                {/* Film info */}
                <div className="flex-1 px-6 pb-6 lg:px-12 lg:pb-10">
                  <div className="max-w-2xl">
                    <p className="text-sm uppercase tracking-widest mb-4 text-white/60">
                      {currentRec.genre} / {currentRec.runtime}
                    </p>

                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl leading-tight font-semibold mb-2">
                      {currentRec.title}
                    </h2>

                    <p className="text-white/60 text-lg mb-4">
                      {currentRec.director}, {currentRec.year}
                    </p>

                    {currentRec.trust && (
                      <p className="text-sm mb-4 flex items-start gap-2" style={{ color: 'var(--gold)' }}>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span>{currentRec.trust}</span>
                      </p>
                    )}

                    <div className="deco-line-gradient w-16 mb-4" />

                    <p className="text-base md:text-lg font-light leading-relaxed mb-3 text-white/90">
                      {currentRec.logline}
                    </p>

                    <p className="text-white/50 italic text-sm md:text-base mb-6">{currentRec.why}</p>

                    {currentRec.links && (
                      <div className="flex items-center gap-4 mb-6">
                        <a href={currentRec.links.imdb} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>IMDb</a>
                        <a href={currentRec.links.rottenTomatoes} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Rotten Tomatoes</a>
                        <a href={currentRec.links.letterboxd} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Letterboxd</a>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowTrailer(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-black font-medium rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--gold)' }}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch Trailer
                      </button>
                      <a
                        href={currentRec.links?.justWatch}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 border rounded-lg text-white/80 text-sm"
                        style={{ borderColor: 'var(--gold-dim)' }}
                      >
                        Where to Stream
                      </a>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/10">
                  <div className="flex items-center gap-4 text-white/40 text-xs">
                    <span>Film data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white/60">TMDB</a></span>
                    <span>·</span>
                    <a href="https://lakumar.com" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white/60">Made by Lakshmi Kumar</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
