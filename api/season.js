/**
 * Subtile - TV Show Season & Episodes Serverless API
 * Fetches season breakdown and episode metadata from TMDB.
 */

export default async function handler(req, res) {
  const { id, season = '1' } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'TV Show ID is required' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    // Dynamic Fallback
    const mockEpisodes = Array.from({ length: 10 }, (_, i) => ({
      episode_number: i + 1,
      name: `Episode ${i + 1}`,
      overview: `Episode ${i + 1} overview details.`,
      still_path: null,
      vote_average: 8.5
    }));
    return res.status(200).json({
      season_number: Number(season),
      episodes: mockEpisodes
    });
  }

  try {
    const tmdbUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}&language=ar-SA`;
    const response = await fetch(tmdbUrl);

    if (!response.ok) {
      // Fallback to English if Arabic is not available
      const enUrl = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${apiKey}&language=en-US`;
      const enRes = await fetch(enUrl);
      if (!enRes.ok) {
        throw new Error(`TMDB Season error: ${enRes.statusText}`);
      }
      const data = await enRes.json();
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json(data);
    }

    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Season API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch season metadata' });
  }
}
