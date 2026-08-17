export default async function handler(req, res) {
  const { query, type = 'multi' } = req.query;
  
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const TMDB_URL = `https://api.themoviedb.org/3/search/${type}?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=ar-SA`;
    const response = await fetch(TMDB_URL);
    if (!response.ok) {
      throw new Error('TMDB API Error');
    }
    const data = await response.json();
    
    // Cache on Edge for 1 hour
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(data);
  } catch (error) {
    console.error('Search API Error:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
}
