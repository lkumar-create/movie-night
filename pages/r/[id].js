import { useState, useEffect, useRef } from 'react';
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

export default function SharedResults() {
  const router = useRouter();
  const { id } = router.query;
  const mainContentRef = useRef(null);
  const carouselRef = useRef(null);

  const [recommendations, setRecommendations] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Fetch shared results
  useEffect(() => {
    if (!id) return;

    const fetchResults = async () => {
      try {
        const response = await fetch(`/api/share?id=${id}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('This link has expired or doesn\'t exist.');
          } else {
            setError('Failed to load recommendations.');
          }
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        setRecommendations(data.recommendations);
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching results:', err);
        setError('Failed to load recommendations.');
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [id]);

  // Scroll-based navigation
  useEffect(() => {
    if (isLoading || !mainContentRef.current) return;

    let scrollTimeout;
    
    const handleWheel = (e) => {
      e.preventDefault();
      
      if (isScrolling) return;
      
      if (e.deltaY > 20 && activeIndex < recommendations.length - 1) {
        setIsScrolling(true);
        setActiveIndex(prev => prev + 1);
        setImageLoaded(false);
      } else if (e.deltaY < -20 && activeIndex > 0) {
        setIsScrolling(true);
        setActiveIndex(prev => prev - 1);
        setImageLoaded(false);
      }
      
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setIsScrolling(false);
      }, 400);
    };

    const container = mainContentRef.current;
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      clearTimeout(scrollTimeout);
    };
  }, [isLoading, activeIndex, recommendations.length, isScrolling]);

  // Touch swipe support
  useEffect(() => {
    if (isLoading || !mainContentRef.current) return;

    let touchStartY = 0;
    
    const handleTouchStart = (e) => {
      touchStartY = e.changedTouches[0].screenY;
    };
    
    const handleTouchEnd = (e) => {
      const touchEndY = e.changedTouches[0].screenY;
      const diff = touchStartY - touchEndY;
      const threshold = 50;

      if (Math.abs(diff) < threshold) return;

      if (diff > 0 && activeIndex < recommendations.length - 1) {
        setActiveIndex(prev => prev + 1);
        setImageLoaded(false);
      } else if (diff < 0 && activeIndex > 0) {
        setActiveIndex(prev => prev - 1);
        setImageLoaded(false);
      }
    };

    const container = mainContentRef.current;
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isLoading, activeIndex, recommendations.length]);

  // Keyboard navigation
  useEffect(() => {
    if (isLoading) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (activeIndex < recommendations.length - 1) {
          setActiveIndex(prev => prev + 1);
          setImageLoaded(false);
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (activeIndex > 0) {
          setActiveIndex(prev => prev - 1);
          setImageLoaded(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, activeIndex, recommendations.length]);

  // Scroll carousel to active item
  useEffect(() => {
    if (carouselRef.current && recommendations.length > 0) {
      const activeItem = carouselRef.current.children[activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeIndex, recommendations.length]);

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
        <meta name="title" content="Movie Night — Shared Recommendations" />
        <meta name="description" content="Check out these movie recommendations from Movie Night!" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://thismovienight.com/r/${id}`} />
        <meta property="og:title" content="Movie Night — Shared Recommendations" />
        <meta property="og:description" content="Check out these movie recommendations!" />
        <meta property="og:image" content="https://thismovienight.com/og-image.png" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="Movie Night — Shared Recommendations" />
        <meta property="twitter:description" content="Check out these movie recommendations!" />
        <meta property="twitter:image" content="https://thismovienight.com/og-image.png" />
      </Head>

      <div className="min-h-screen bg-black text-white results-lock">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500&display=swap');

          :root {
            --gold: #C9A962;
            --gold-light: #E5D4A1;
            --gold-dark: #8B7235;
            --gold-dim: rgba(201, 169, 98, 0.6);
            --gold-glow: rgba(201, 169, 98, 0.15);
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            -webkit-font-smoothing: antialiased;
            background: #000;
          }

          .results-lock {
            overflow: hidden;
            height: 100vh;
          }

          .font-display {
            font-family: 'Playfair Display', Georgia, serif;
          }

          .text-gold { color: var(--gold); }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .animate-fadeIn {
            animation: fadeIn 0.6s ease-out forwards;
          }

          .animate-slideUp {
            animation: slideUp 0.6s ease-out forwards;
          }

          .film-grain {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 50;
            opacity: 0.04;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          }

          .deco-corner {
            position: relative;
          }
          .deco-corner::before {
            content: '';
            position: absolute;
            top: -16px;
            left: 0;
            width: 32px;
            height: 32px;
            border-left: 1px solid var(--gold-dim);
            border-top: 1px solid var(--gold-dim);
          }

          .deco-line-gradient {
            height: 1px;
            background: linear-gradient(90deg, var(--gold), var(--gold-dim), transparent);
          }

          .carousel-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .carousel-scroll::-webkit-scrollbar {
            display: none;
          }

          .review-link {
            opacity: 0.6;
            transition: opacity 0.2s;
          }
          .review-link:hover {
            opacity: 1;
          }
        `}</style>

        {/* Film Grain Overlay */}
        {!isLoading && isVintageFilm && <div className="film-grain" />}

        {/* Decade Color Tint Overlay */}
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
                className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors"
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
            <p className="font-display text-2xl md:text-3xl italic animate-fadeIn text-white/70">
              Loading recommendations...
            </p>
            <div className="mt-8 w-48 h-px overflow-hidden" style={{ backgroundColor: 'var(--gold-glow)' }}>
              <div className="h-full w-1/2 animate-pulse" style={{ backgroundColor: 'var(--gold)' }} />
            </div>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="h-screen flex flex-col items-center justify-center px-8 text-center">
            <div className="text-6xl mb-6">🎬</div>
            <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: 'var(--gold)' }}>
              Oops!
            </h2>
            <p className="text-white/60 max-w-md mb-8">{error}</p>
            <a
              href="/"
              className="px-6 py-3 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--gold)', color: '#000' }}
            >
              Start your own Movie Night
            </a>
          </div>
        )}

        {/* RESULTS VIEW */}
        {!isLoading && !error && currentRec && (
          <div className="h-screen flex flex-col lg:flex-row relative z-20 overflow-hidden">
            
            {/* Main Content */}
            <div ref={mainContentRef} className="flex-1 relative min-h-[60vh] lg:min-h-screen order-1">
              {/* Background Image */}
              {backdropUrl && (
                <div className="absolute inset-0">
                  <img
                    src={backdropUrl}
                    alt=""
                    className={`w-full h-full object-cover transition-opacity duration-700 ${
                      imageLoaded ? 'opacity-50' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
                </div>
              )}

              <div className="relative h-full flex flex-col justify-between px-6 md:px-12 lg:px-16 pb-6 lg:pb-10 pt-6">
                {/* Top bar */}
                <div className="flex justify-between items-center">
                  <a
                    href="/"
                    className="flex items-center gap-2 transition-colors text-white/50 hover:text-white/80"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span className="text-sm">Make your own</span>
                  </a>
                  
                  <button
                    onClick={copyCurrentUrl}
                    className="flex items-center gap-2 transition-colors text-sm text-white/50 hover:text-white/80"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                    Share
                  </button>
                </div>

                {/* Film info */}
                <div className="max-w-2xl animate-slideUp flex-1 flex flex-col justify-center py-8">
                  <div className="deco-corner">
                    <p className="text-sm uppercase tracking-widest mb-4 text-white/60">
                      {currentRec.genre} / {currentRec.runtime}
                    </p>
                  </div>

                  <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-none font-semibold mb-2">
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

                  <p className="text-lg md:text-xl font-light leading-relaxed mb-3 text-white/90">
                    {currentRec.logline}
                  </p>

                  <p className="text-white/50 italic mb-6">{currentRec.why}</p>

                  {currentRec.links && (
                    <div className="flex items-center gap-4 mb-6">
                      <a href={currentRec.links.imdb} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>IMDb</a>
                      <a href={currentRec.links.rottenTomatoes} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Rotten Tomatoes</a>
                      <a href={currentRec.links.letterboxd} target="_blank" rel="noopener noreferrer" className="review-link text-xs uppercase tracking-wider" style={{ color: 'var(--gold)' }}>Letterboxd</a>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setShowTrailer(true)}
                      className="flex items-center gap-3 px-6 py-3 text-black font-medium transition-all hover:opacity-90 rounded-lg"
                      style={{ backgroundColor: 'var(--gold)' }}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      Watch Trailer
                    </button>
                    <a
                      href={currentRec.links?.justWatch || `https://www.justwatch.com/us/search?q=${encodeURIComponent(currentRec.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-6 py-3 border transition-all hover:bg-white/5 rounded-lg text-white/80"
                      style={{ borderColor: 'var(--gold-dim)' }}
                    >
                      Where to Stream
                    </a>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-4 text-white/40 text-xs">
                    <span>Film data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors text-white/50">TMDB</a></span>
                    <span>·</span>
                    <a href="https://lakumar.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white/60 text-white/50">Made by Lakshmi Kumar</a>
                  </div>
                </div>
              </div>
            </div>

            {/* Carousel */}
            <div 
              ref={carouselRef}
              className="flex-shrink-0 p-4 lg:py-8 lg:pr-8 lg:pl-4 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto lg:overflow-x-hidden carousel-scroll lg:w-44 lg:h-screen bg-black/80 lg:bg-transparent order-2"
            >
              {recommendations.map((rec, idx) => {
                const colors = [
                  'from-amber-900/80 to-amber-950',
                  'from-emerald-900/80 to-emerald-950',
                  'from-blue-900/80 to-blue-950',
                  'from-purple-900/80 to-purple-950',
                  'from-rose-900/80 to-rose-950',
                  'from-cyan-900/80 to-cyan-950',
                ];
                const colorIndex = rec.title.length % colors.length;
                
                return (
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
                    <div className={`w-24 lg:w-full h-20 lg:h-24 flex items-center justify-center p-3 text-center bg-gradient-to-br ${colors[colorIndex]}`}>
                      <span className="text-xs text-white/90 font-medium leading-tight line-clamp-3">{rec.title}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
