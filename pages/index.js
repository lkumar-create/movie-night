import { useState } from 'react';
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

export default function Home() {
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

  const canSubmit = customVibe.trim() || selectedMoods.length > 0 || selectedWatch || selectedLength;

  const toggleMood = (mood) => {
    setSelectedMoods((prev) =>
      prev.includes(mood) ? prev.filter((m) => m !== mood) : [...prev, mood]
    );
  };

  const getRecommendations = async () => {
    setIsLoading(true);
    setShowResults(false);
    setImageLoaded(false);

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

      const data = await response.json();
      clearInterval(phraseInterval);

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
  };

  const currentRec = recommendations[activeIndex];

  const backdropUrl = currentRec?.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${currentRec.backdrop_path}`
    : null;

  return (
    <>
      <Head>
        <title>Movie Night</title>
        <meta name="description" content="Find your perfect movie based on your mood" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-black text-white">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500&display=swap');

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

          .font-display {
            font-family: 'Playfair Display', Georgia, serif;
          }

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
        `}</style>

        {/* LANDING VIEW */}
        {!showResults && !isLoading && (
          <div className="min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-5xl">
            <h1
              className="font-display text-6xl md:text-8xl lg:text-9xl leading-none tracking-tight font-semibold mb-6"
            >
              Movie<br />Night
            </h1>

            {/* Mode Toggle */}
            <div className="flex items-center gap-4 mb-12">
              <button
                onClick={() => setBadMovieMode(false)}
                className={`text-sm transition-all ${!badMovieMode ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
              >
                Good Films
              </button>
              <button
                onClick={() => setBadMovieMode(!badMovieMode)}
                className={`w-12 h-6 rounded-full transition-all ${badMovieMode ? 'bg-red-500' : 'bg-white/20'} relative`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${badMovieMode ? 'left-6' : 'left-0.5'}`}
                />
              </button>
              <button
                onClick={() => setBadMovieMode(true)}
                className={`text-sm transition-all ${badMovieMode ? 'text-red-400' : 'text-white/40 hover:text-white/60'}`}
              >
                So Bad It's Good
              </button>
            </div>

            <div className="mb-12">
              <p className="text-white/40 text-xs uppercase tracking-widest mb-4">
                {badMovieMode ? 'What kind of trash are you looking for?' : 'What are you in the mood for?'}
              </p>
              <input
                type="text"
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={badMovieMode ? 'Explosions with terrible dialogue...' : 'Something like Fleabag but funnier...'}
                className="w-full bg-transparent text-xl md:text-2xl font-light border-b border-white/20 pb-4 focus:border-white/50 focus:outline-none transition-colors placeholder:text-white/20"
              />
            </div>

            <div className="space-y-8 mb-16">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Mood</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((mood) => (
                    <button
                      key={mood}
                      onClick={() => toggleMood(mood)}
                      className={`px-4 py-2 text-sm border rounded-full transition-all ${
                        selectedMoods.includes(mood)
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-white text-black border-white'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Watching</p>
                <div className="flex flex-wrap gap-2">
                  {WATCH_WITH.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setSelectedWatch(selectedWatch === opt ? null : opt)}
                      className={`px-4 py-2 text-sm border rounded-full transition-all ${
                        selectedWatch === opt
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-white text-black border-white'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Length</p>
                <div className="flex flex-wrap gap-2">
                  {LENGTHS.map((len) => (
                    <button
                      key={len}
                      onClick={() => setSelectedLength(selectedLength === len ? null : len)}
                      className={`px-4 py-2 text-sm border rounded-full transition-all ${
                        selectedLength === len
                          ? badMovieMode
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-white text-black border-white'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={getRecommendations}
              disabled={!canSubmit}
              className={`flex items-center gap-4 text-lg transition-all ${
                canSubmit ? 'text-white hover:gap-6' : 'text-white/20 cursor-not-allowed'
              }`}
            >
              <span className="font-display italic">
                {badMovieMode ? 'Find me trash' : 'Find my film'}
              </span>
              <svg
                className="w-6 h-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 8.25L21 12m0 0l-3.75 3.75M21 12H3" />
              </svg>
            </button>

            {/* TMDB Attribution */}
            <div className="mt-24 pt-8 border-t border-white/10">
              <div className="flex items-center gap-3 text-white/30 text-xs">
                <svg className="w-12 h-5" viewBox="0 0 190 28" fill="currentColor">
                  <path d="M105.67 0H96.76V28h8.91V0zM84.91 4.15h9.6V0h-23.4v4.15h9.6v23.85h4.2V4.15zM33.09 28L29.9 18.44H12.57L9.38 28H4.71L17.65 0h7.17L37.76 28h-4.67zM21.24 4.15l-7.2 10.14h14.4l-7.2-10.14zM66.29 28h-4.4L43.55 4.98V28h-4.17V0h5.65l17.09 21.58V0h4.17v28z"/>
                  <path d="M127.81 27.3c-7.32 0-13.09-6.14-13.09-13.65S120.49.7 127.81.7c7.31 0 13.08 6.14 13.08 13.65 0 7.51-5.77 13.65-13.08 13.65v-.7zm0-23.15c-5.12 0-8.89 4.1-8.89 9.5s3.77 9.5 8.89 9.5c5.12 0 8.88-4.1 8.88-9.5s-3.76-9.5-8.88-9.5z"/>
                  <path d="M162.72 28h-4.54l-8.08-11.47-8.08 11.47h-4.53l10.34-14L138.36 0h4.54l7.74 10.96L158.38 0h4.53l-9.47 13.47L162.72 28zM189.58 4.15h-10.96V28h-4.2V4.15h-10.97V0h26.13v4.15z"/>
                </svg>
                <span>This product uses the TMDB API but is not endorsed or certified by TMDB.</span>
              </div>
            </div>
          </div>
        )}

        {/* LOADING VIEW */}
        {isLoading && (
          <div className="min-h-screen flex flex-col items-center justify-center px-8">
            <p className="font-display text-2xl md:text-3xl italic text-white/60 animate-fadeIn">
              {loadingPhrase}
            </p>
            <div className="mt-8 w-48 h-px bg-white/10 overflow-hidden">
              <div className="h-full w-1/2 bg-white/40 animate-pulse" />
            </div>
          </div>
        )}

        {/* RESULTS VIEW */}
        {showResults && currentRec && (
          <div className="min-h-screen relative">
            {/* Background Image */}
            {backdropUrl && (
              <div className="absolute inset-0">
                <img
                  src={backdropUrl}
                  alt=""
                  className={`w-full h-full object-cover transition-opacity duration-1000 ${
                    imageLoaded ? 'opacity-30' : 'opacity-0'
                  }`}
                  onLoad={() => setImageLoaded(true)}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
              </div>
            )}

            <div className="relative min-h-screen flex flex-col justify-end px-8 md:px-16 lg:px-24 pb-16 pt-24">
              {/* Back button */}
              <button
                onClick={resetAll}
                className="absolute top-8 left-8 md:left-16 flex items-center gap-2 text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span className="text-sm">Start over</span>
              </button>

              {/* Navigation dots */}
              <div className="absolute top-1/2 right-8 md:right-16 -translate-y-1/2 flex flex-col gap-3">
                {recommendations.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveIndex(idx);
                      setImageLoaded(false);
                    }}
                    className={`w-2 h-2 rounded-full border transition-all ${
                      idx === activeIndex ? 'bg-white border-white' : 'border-white/40 hover:border-white'
                    }`}
                  />
                ))}
              </div>

              {/* Film info */}
              <div className="max-w-2xl animate-slideUp">
                <p className="text-white/40 text-sm uppercase tracking-widest mb-4">
                  {currentRec.genre} / {currentRec.runtime}
                </p>

                <h2 className="font-display text-5xl md:text-7xl lg:text-8xl leading-none font-semibold mb-2">
                  {currentRec.title}
                </h2>

                <p className="text-white/50 text-lg mb-6">
                  {currentRec.director}, {currentRec.year}
                </p>

                {/* Trust Signal */}
                {currentRec.trust && (
                  <p className={`text-sm mb-6 ${badMovieMode ? 'text-red-400' : 'text-amber-400'}`}>
                    {currentRec.trust}
                  </p>
                )}

                <div className="h-px w-24 bg-white/20 mb-6" />

                <p className="text-xl md:text-2xl font-light leading-relaxed mb-4 text-white/80">
                  {currentRec.logline}
                </p>

                <p className="text-white/40 italic mb-12">{currentRec.why}</p>

                {/* Actions */}
                <div className="flex flex-wrap gap-4">
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                      currentRec.title + ' ' + currentRec.year + ' official trailer'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 bg-white text-black font-medium hover:bg-white/90 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Watch Trailer
                  </a>
                  <a
                    href={`https://www.justwatch.com/us/search?q=${encodeURIComponent(currentRec.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 py-3 border border-white/30 hover:bg-white/10 transition-colors"
                  >
                    Where to Stream
                  </a>
                </div>
              </div>

              {/* Reroll & Attribution */}
              <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <button
                  onClick={getRecommendations}
                  className="flex items-center gap-3 text-white/40 hover:text-white transition-colors"
                >
                  <span className="text-sm">Show me different options</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                    />
                  </svg>
                </button>

                {/* TMDB Attribution */}
                <div className="flex items-center gap-3 text-white/30 text-xs">
                  <span>Film data from</span>
                  <a
                    href="https://www.themoviedb.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white/50 transition-colors"
                  >
                    TMDB
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
