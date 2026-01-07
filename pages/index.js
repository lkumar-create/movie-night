import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const MOODS = ['Cerebral', 'Emotional', 'Hilarious', 'Terrifying', 'Comforting', 'Epic'];
const WATCH_WITH = ['Solo', 'Date Night', 'Family', 'Friends'];
const LENGTHS = ['Under 90min', 'Feature', 'Limited Series', 'No Limit'];

const LOADING_PHRASES = [
  'Searching the archives',
  'Curating your evening',
  'Finding the perfect mood',
  'Rolling the reels',
];

const BAD_LOADING_PHRASES = [
  'Digging through the bargain bin',
  'Consulting the cult classics',
  'Finding beautiful disasters',
  'Unearthing hidden trash',
];

// Decade color tints (labels removed - just tints now)
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

export default function Home() {
  const router = useRouter();
  const mainContentRef = useRef(null);
  const carouselRef = useRef(null);
  
  const [customVibe, setCustomVibe] = useState('');
  const [selectedMoods, setSelectedMoods] = useState([]);
  const [selectedWatch, setSelectedWatch] = useState(null);
  const [selectedLength, setSelectedLength] = useState(null);
  const [badMovieMode, setBadMovieMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);

  // Load state from URL params on mount and auto-search if params exist
  useEffect(() => {
    if (router.isReady) {
      const { mood, watch, length, vibe, mode } = router.query;
      const hasParams = mood || watch || length || vibe;
      
      if (mood) setSelectedMoods(mood.split(','));
      if (watch) setSelectedWatch(watch);
      if (length) setSelectedLength(length);
      if (vibe) setCustomVibe(vibe);
      if (mode === 'bad') setBadMovieMode(true);
      
      // Auto-search if URL has search params (shareable link)
      if (hasParams && !showResults && !isLoading) {
        setTimeout(() => {
          triggerSearch(mood, watch, length, vibe, mode === 'bad');
        }, 100);
      }
    }
  }, [router.isReady]);

  // Keep activeIndex ref in sync (for desktop scroll if needed later)
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!showResults) return;

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
  }, [showResults, activeIndex, recommendations.length]);

  // Scroll carousel to active item
  useEffect(() => {
    if (carouselRef.current && recommendations.length > 0) {
      const activeItem = carouselRef.current.children[activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeIndex, recommendations.length]);

  const canSubmit = customVibe.trim() || selectedMoods.length > 0 || selectedWatch || selectedLength;

  const toggleMood = (mood) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const currentRec = recommendations[activeIndex];
  const isVintageFilm = currentRec?.year && parseInt(currentRec.year) < 1990;
  const decadeColor = getDecadeColor(currentRec?.year);

  const [isSharing, setIsSharing] = useState(false);

  const copyShareLink = async () => {
    if (isSharing) return;
    setIsSharing(true);
    
    try {
      // Filter to only include recommendations with valid TMDB IDs
      const validRecs = recommendations.filter(rec => rec.tmdb_id);
      
      console.log('Recommendations:', recommendations.map(r => ({ title: r.title, tmdb_id: r.tmdb_id })));
      console.log('Valid recs with TMDB ID:', validRecs.length);
      
      if (validRecs.length === 0) {
        // Fallback: use search params URL if no TMDB IDs
        const params = new URLSearchParams();
        if (selectedMoods.length > 0) params.set('mood', selectedMoods.join(','));
        if (selectedWatch) params.set('watch', selectedWatch);
        if (selectedLength) params.set('length', selectedLength);
        if (customVibe.trim()) params.set('vibe', customVibe.trim());
        if (badMovieMode) params.set('mode', 'bad');
        
        const fallbackUrl = `https://thismovienight.com/?${params.toString()}`;
        await navigator.clipboard.writeText(fallbackUrl);
        alert('Link copied! (Your friend will get similar recommendations based on the same search.)');
        setIsSharing(false);
        return;
      }
      
      // Get TMDB IDs for URL
      const ids = validRecs.map(rec => rec.tmdb_id).join(',');
      
      // Encode display data (why, trust, logline) - keeps the personalized recommendations
      const displayData = validRecs.map(rec => ({
        l: rec.logline?.substring(0, 200), // logline (truncated)
        w: rec.why?.substring(0, 150),     // why
        t: rec.trust?.substring(0, 100)    // trust signal
      }));
      
      const encoded = encodeURIComponent(JSON.stringify(displayData));
      const url = `https://thismovienight.com/s?ids=${ids}&d=${encoded}`;
      
      await navigator.clipboard.writeText(url);
      alert('Link copied! Your friends will see the exact same recommendations.');
    } catch (err) {
      console.error('Share error:', err);
      alert('Could not copy link. Please try again.');
    }
    
    setIsSharing(false);
  };

  // Trigger search from URL params
  const triggerSearch = async (mood, watch, length, vibe, isBadMode) => {
    setIsLoading(true);
    setShowResults(false);
    setImageLoaded(false);

    const phrases = isBadMode ? BAD_LOADING_PHRASES : LOADING_PHRASES;
    let phraseIndex = 0;
    setLoadingPhrase(phrases[0]);
    const phraseInterval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setLoadingPhrase(phrases[phraseIndex]);
    }, 2000);

    const preferences = [];
    if (mood) preferences.push(`Mood: ${mood}`);
    if (watch) preferences.push(`Watching: ${watch}`);
    if (length) preferences.push(`Length: ${length}`);
    if (vibe) preferences.push(`Request: "${vibe}"`);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          mode: isBadMode ? 'bad' : 'good',
        }),
      });

      clearInterval(phraseInterval);

      if (response.status === 429) {
        const data = await response.json();
        setRateLimitError(data.message);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.recommendations) {
        setRecommendations(data.recommendations);
        setActiveIndex(0);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Error:', error);
      clearInterval(phraseInterval);
    }

    setIsLoading(false);
  };

  const getRecommendations = async () => {
    setIsLoading(true);
    setShowResults(false);
    setImageLoaded(false);
    setRateLimitError(null);

    const phrases = badMovieMode ? BAD_LOADING_PHRASES : LOADING_PHRASES;
    let phraseIndex = 0;
    setLoadingPhrase(phrases[0]);
    const phraseInterval = setInterval(() => {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      setLoadingPhrase(phrases[phraseIndex]);
    }, 2000);

    const preferences = [];
    if (selectedMoods.length > 0) preferences.push(`Mood: ${selectedMoods.join(', ')}`);
    if (selectedWatch) preferences.push(`Watching: ${selectedWatch}`);
    if (selectedLength) preferences.push(`Length: ${selectedLength}`);
    if (customVibe.trim()) preferences.push(`Request: "${customVibe.trim()}"`);

    try {
      const response = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          mode: badMovieMode ? 'bad' : 'good',
        }),
      });

      clearInterval(phraseInterval);

      if (response.status === 429) {
        const data = await response.json();
        setRateLimitError(data.message);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.recommendations) {
        setRecommendations(data.recommendations);
        setActiveIndex(0);
        setShowResults(true);
        
        const params = new URLSearchParams();
        if (selectedMoods.length > 0) params.set('mood', selectedMoods.join(','));
        if (selectedWatch) params.set('watch', selectedWatch);
        if (selectedLength) params.set('length', selectedLength);
        if (customVibe.trim()) params.set('vibe', customVibe.trim());
        if (badMovieMode) params.set('mode', 'bad');
        
        const newUrl = params.toString() ? `/?${params.toString()}` : '/';
        window.history.replaceState({}, '', newUrl);
      }
    } catch (error) {
      console.error('Error:', error);
      clearInterval(phraseInterval);
    }

    setIsLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      getRecommendations();
    }
  };

  const resetAll = () => {
    setShowResults(false);
    setRecommendations([]);
    setCustomVibe('');
    setSelectedMoods([]);
    setSelectedWatch(null);
    setSelectedLength(null);
    setActiveIndex(0);
    setShowTrailer(false);
    setRateLimitError(null);
    window.history.replaceState({}, '', '/');
  };

  const selectFilm = (index) => {
    setActiveIndex(index);
    setImageLoaded(false);
    setShowTrailer(false);
  };

  const backdropUrl = currentRec?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${currentRec.backdrop_path}`
    : null;

  const posterUrl = (rec) => rec?.poster_path
    ? `https://image.tmdb.org/t/p/w342${rec.poster_path}`
    : null;

  return (
    <>
      <Head>
        <title>Movie Night — Find Your Perfect Film</title>
        <meta name="title" content="Movie Night — Find Your Perfect Film" />
        <meta name="description" content="Tell us your mood, we'll find your movie. AI-powered recommendations from global cinema — no algorithms, just taste." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thismovienight.com/" />
        <meta property="og:title" content="Movie Night — Find Your Perfect Film" />
        <meta property="og:description" content="Tell us your mood, we'll find your movie. AI-powered recommendations from global cinema." />
        <meta property="og:image" content="https://thismovienight.com/og-image.png" />

        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://thismovienight.com/" />
        <meta property="twitter:title" content="Movie Night — Find Your Perfect Film" />
        <meta property="twitter:description" content="Tell us your mood, we'll find your movie. AI-powered recommendations from global cinema." />
        <meta property="twitter:image" content="https://thismovienight.com/og-image.png" />

        <link rel="canonical" href="https://thismovienight.com/" />
      </Head>

      <div className={`min-h-screen bg-black text-white ${showResults ? 'results-lock' : ''}`}>
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
          .text-gold-dim { color: var(--gold-dim); }
          .bg-gold { background-color: var(--gold); }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }

          .animate-fadeIn {
            animation: fadeIn 0.6s ease-out forwards;
          }

          .animate-slideUp {
            animation: slideUp 0.6s ease-out forwards;
          }

          .animate-bounce {
            animation: bounce 2s infinite;
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

          .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
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
        {showResults && isVintageFilm && <div className="film-grain" />}

        {/* Decade Color Tint Overlay */}
        {showResults && currentRec && (
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

        {/* RATE LIMIT ERROR */}
        {rateLimitError && (
          <div className="h-screen flex flex-col items-center justify-center px-8 text-center">
            <div className="text-6xl mb-6">🎬</div>
            <h2 className="font-display text-3xl md:text-4xl mb-4" style={{ color: 'var(--gold)' }}>
              That's a wrap for today!
            </h2>
            <p className="text-white/60 max-w-md mb-8">
              {rateLimitError}
            </p>
            <button
              onClick={resetAll}
              className="px-6 py-3 border rounded-lg transition-colors"
              style={{ borderColor: 'var(--gold-dim)' }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--gold)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--gold-dim)'}
            >
              Back to home
            </button>
          </div>
        )}

        {/* LANDING VIEW */}
        {!showResults && !isLoading && !rateLimitError && (
          <div className="min-h-screen flex flex-col justify-center px-6 md:px-16 lg:px-24 py-20 max-w-5xl">
            
            <div className="deco-corner">
              <h1 className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-tight font-semibold mb-2">
                Movie<br /><span className="text-gold">Night</span>
              </h1>
            </div>

            <div className="deco-line-gradient w-24 mb-16 mt-6" />

            {/* Mode Toggle */}
            <div className="flex items-center gap-4 mb-12">
              <button
                onClick={() => setBadMovieMode(false)}
                className={`text-sm transition-all ${!badMovieMode ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
              >
                Good Films
              </button>
              <button
                onClick={() => setBadMovieMode(!badMovieMode)}
                className={`w-12 h-6 rounded-full transition-all relative ${badMovieMode ? 'bg-red-500' : 'bg-white/10'}`}
                style={{ borderColor: badMovieMode ? 'transparent' : 'var(--gold-dim)', borderWidth: badMovieMode ? 0 : 1 }}
              >
                <div
                  className={`w-5 h-5 rounded-full absolute top-0.5 transition-all ${badMovieMode ? 'left-6 bg-white' : 'left-0.5'}`}
                  style={{ backgroundColor: badMovieMode ? 'white' : 'var(--gold)' }}
                />
              </button>
              <button
                onClick={() => setBadMovieMode(true)}
                className={`text-sm transition-all ${badMovieMode ? 'text-red-400' : 'text-white/50 hover:text-white/70'}`}
              >
                So Bad It's Good
              </button>
            </div>

            <div className="mb-12">
              {/* Labels now use gold */}
              <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--gold)' }}>
                {badMovieMode ? 'What kind of trash are you looking for?' : 'What are you in the mood for?'}
              </p>
              <input
                type="text"
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={badMovieMode ? 'Explosions with terrible dialogue...' : 'Something like Fleabag but funnier...'}
                className="w-full bg-transparent text-xl md:text-2xl font-light pb-4 focus:outline-none transition-colors placeholder:text-white/30"
                style={{ borderBottom: '1px solid var(--gold-dim)' }}
                onFocus={(e) => e.target.style.borderColor = 'var(--gold)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--gold-dim)'}
              />
            </div>

            <div className="space-y-10 mb-16">
              <div>
                {/* Labels use gold */}
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--gold)' }}>Mood</p>
                <div className="flex flex-wrap gap-3">
                  {MOODS.map((mood) => (
                    <button
                      key={mood}
                      onClick={() => toggleMood(mood)}
                      className={`px-5 py-2.5 text-sm border rounded-full transition-all ${
                        selectedMoods.includes(mood)
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'text-black border-transparent'
                          : 'text-white/80 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: selectedMoods.includes(mood) && !badMovieMode ? 'var(--gold)' : undefined,
                        borderColor: selectedMoods.includes(mood) 
                          ? (badMovieMode ? undefined : 'var(--gold)') 
                          : 'var(--gold-dim)',
                      }}
                      onMouseEnter={(e) => {
                        if (!selectedMoods.includes(mood)) e.target.style.borderColor = 'var(--gold)';
                      }}
                      onMouseLeave={(e) => {
                        if (!selectedMoods.includes(mood)) e.target.style.borderColor = 'var(--gold-dim)';
                      }}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {/* Labels use gold */}
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--gold)' }}>Watching</p>
                <div className="flex flex-wrap gap-3">
                  {WATCH_WITH.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedWatch(selectedWatch === opt ? null : opt)}
                      className={`px-5 py-2.5 text-sm border rounded-full transition-all ${
                        selectedWatch === opt
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'text-black border-transparent'
                          : 'text-white/80 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: selectedWatch === opt && !badMovieMode ? 'var(--gold)' : undefined,
                        borderColor: selectedWatch === opt 
                          ? (badMovieMode ? undefined : 'var(--gold)') 
                          : 'var(--gold-dim)',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedWatch !== opt) e.target.style.borderColor = 'var(--gold)';
                      }}
                      onMouseLeave={(e) => {
                        if (selectedWatch !== opt) e.target.style.borderColor = 'var(--gold-dim)';
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                {/* Labels use gold */}
                <p className="text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--gold)' }}>Length</p>
                <div className="flex flex-wrap gap-3">
                  {LENGTHS.map((len) => (
                    <button
                      key={len}
                      onClick={() => setSelectedLength(selectedLength === len ? null : len)}
                      className={`px-5 py-2.5 text-sm border rounded-full transition-all ${
                        selectedLength === len
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'text-black border-transparent'
                          : 'text-white/80 hover:text-white'
                      }`}
                      style={{
                        backgroundColor: selectedLength === len && !badMovieMode ? 'var(--gold)' : undefined,
                        borderColor: selectedLength === len 
                          ? (badMovieMode ? undefined : 'var(--gold)') 
                          : 'var(--gold-dim)',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedLength !== len) e.target.style.borderColor = 'var(--gold)';
                      }}
                      onMouseLeave={(e) => {
                        if (selectedLength !== len) e.target.style.borderColor = 'var(--gold-dim)';
                      }}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FIND MY FILM - NOW A BUTTON */}
            <button
              onClick={getRecommendations}
              disabled={!canSubmit}
              className={`flex items-center gap-4 px-8 py-4 rounded-lg font-display italic text-lg transition-all ${
                canSubmit 
                  ? 'hover:opacity-90' 
                  : 'opacity-30 cursor-not-allowed'
              }`}
              style={{ 
                backgroundColor: canSubmit ? 'var(--gold)' : 'var(--gold-dim)',
                color: '#000',
                width: 'fit-content'
              }}
            >
              <span>{badMovieMode ? 'Find me trash' : 'Find my film'}</span>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </button>

            {/* Footer - LEFT ALIGNED */}
            <div className="mt-24 pt-8" style={{ borderTop: '1px solid var(--gold-dim)' }}>
              <div className="flex items-center gap-4 text-white/40 text-xs">
                <span>Film data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors text-white/50">TMDB</a></span>
                <span>·</span>
                <a 
                  href="https://lakumar.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white/60 text-white/50"
                >
                  Made by Lakshmi Kumar
                </a>
              </div>
            </div>
          </div>
        )}

        {/* LOADING VIEW */}
        {isLoading && (
          <div className="h-screen flex flex-col items-center justify-center px-8">
            {/* INCREASED CONTRAST for loading text */}
            <p className="font-display text-2xl md:text-3xl italic animate-fadeIn" style={{ color: 'var(--gold)' }}>
              {loadingPhrase}
            </p>
            <div className="mt-8 w-48 h-px overflow-hidden" style={{ backgroundColor: 'var(--gold-glow)' }}>
              <div className="h-full w-1/2 animate-pulse" style={{ backgroundColor: 'var(--gold)' }} />
            </div>
          </div>
        )}

        {/* RESULTS VIEW */}
        {showResults && currentRec && (
          <div className="min-h-screen lg:flex lg:flex-row relative z-20">
            
            {/* Desktop: Sidebar on right */}
            <div className="hidden lg:flex flex-shrink-0 py-8 pr-8 pl-4 flex-col gap-3 overflow-y-auto carousel-scroll w-44 h-screen bg-transparent order-2">
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

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col order-1 pb-16 lg:pb-0">
              
              {/* Background Image */}
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

              {/* Scrollable Content */}
              <div className="relative flex-1 flex flex-col">
                
                {/* Top bar */}
                <div className="flex justify-between items-center px-6 py-4">
                  <button
                    onClick={resetAll}
                    className="flex items-center gap-2 transition-colors text-white/50 hover:text-white/80"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    <span className="text-sm">Start over</span>
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <button
                      onClick={getRecommendations}
                      className="p-2 transition-colors text-white/50 hover:text-white/80"
                      title="Get new recommendations"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={copyShareLink}
                      className="flex items-center gap-2 transition-colors text-sm text-white/50 hover:text-white/80"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                      Share
                    </button>
                  </div>
                </div>

                {/* Film info */}
                <div className="flex-1 px-6 pb-6 lg:px-12 lg:pb-10">
                  <div className="max-w-2xl">
                    {/* Genre / Duration */}
                    <p className="text-sm uppercase tracking-widest mb-4 text-white/60">
                      {currentRec.genre} / {currentRec.runtime}
                    </p>

                    {/* Title */}
                    <h2 className="font-display text-3xl md:text-4xl lg:text-5xl leading-tight font-semibold mb-2">
                      {currentRec.title}
                    </h2>

                    {/* Director, Year */}
                    <p className="text-white/60 text-lg mb-4">
                      {currentRec.director}, {currentRec.year}
                    </p>

                    {/* Trust Signal */}
                    {currentRec.trust && (
                      <p className="text-sm mb-4 flex items-start gap-2" style={{ color: badMovieMode ? '#ef4444' : 'var(--gold)' }}>
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                        <span>{currentRec.trust}</span>
                      </p>
                    )}

                    <div className="deco-line-gradient w-16 mb-4" />

                    {/* Synopsis / Logline */}
                    <p className="text-base md:text-lg font-light leading-relaxed mb-3 text-white/90">
                      {currentRec.logline}
                    </p>

                    {/* Why / Your review */}
                    <p className="text-white/50 italic text-sm md:text-base mb-6">{currentRec.why}</p>

                    {/* Review Site Links */}
                    {currentRec.links && (
                      <div className="flex items-center gap-4 mb-6">
                        <a
                          href={currentRec.links.imdb}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="review-link text-xs uppercase tracking-wider"
                          style={{ color: 'var(--gold)' }}
                        >
                          IMDb
                        </a>
                        <a
                          href={currentRec.links.rottenTomatoes}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="review-link text-xs uppercase tracking-wider"
                          style={{ color: 'var(--gold)' }}
                        >
                          Rotten Tomatoes
                        </a>
                        <a
                          href={currentRec.links.letterboxd}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="review-link text-xs uppercase tracking-wider"
                          style={{ color: 'var(--gold)' }}
                        >
                          Letterboxd
                        </a>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShowTrailer(true)}
                        className="flex items-center gap-2 px-5 py-2.5 text-black font-medium transition-all hover:opacity-90 rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--gold)' }}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch Trailer
                      </button>
                      <a
                        href={currentRec.links?.justWatch || `https://www.justwatch.com/us/search?q=${encodeURIComponent(currentRec.title)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 border transition-all hover:bg-white/5 rounded-lg text-white/80 text-sm"
                        style={{ borderColor: 'var(--gold-dim)' }}
                      >
                        Where to Stream
                      </a>
                    </div>
                  </div>
                </div>

                {/* Footer - desktop only, mobile has fixed bottom */}
                <div className="hidden lg:block px-6 py-4 border-t border-white/10">
                  <div className="flex items-center gap-4 text-white/40 text-xs">
                    <span>Film data from <a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="hover:text-white/60 transition-colors text-white/50">TMDB</a></span>
                    <span>·</span>
                    <a href="https://lakumar.com" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white/60 text-white/50">
                      Made by Lakshmi Kumar
                    </a>
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
