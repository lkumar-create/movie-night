# Movie Night

An AI-powered movie recommendation app that helps you find what to watch based on your mood.

## Features

- **Mood-based recommendations** — Select your mood, who you're watching with, and how much time you have
- **Free text input** — Describe exactly what you're looking for
- **"So Bad It's Good" mode** — Find gloriously terrible movies for ironic viewing
- **Global cinema** — Recommendations from around the world, not just Hollywood
- **Trust signals** — See Rotten Tomatoes scores, festival wins, and cultural context
- **Real movie posters** — Beautiful backdrop images from TMDB
- **Trailer links** — Jump straight to YouTube trailers
- **Streaming info** — Find where to watch via JustWatch

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/movie-night.git
cd movie-night
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the root directory:

```
TMDB_API_KEY=your_tmdb_api_key
TMDB_ACCESS_TOKEN=your_tmdb_access_token
ANTHROPIC_API_KEY=your_anthropic_api_key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your GitHub repo
3. Add your environment variables in the Vercel dashboard:
   - `TMDB_API_KEY`
   - `TMDB_ACCESS_TOKEN`
   - `ANTHROPIC_API_KEY`
4. Deploy!

## Attribution

This product uses the [TMDB API](https://www.themoviedb.org) but is not endorsed or certified by TMDB.

## License

MIT
