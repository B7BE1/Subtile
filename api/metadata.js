export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;
  
  if (!id) return res.status(400).json({ error: 'ID is required' });

  try {
    const TMDB_URL = `https://api.themoviedb.org/3/${type}/${id}?api_key=${process.env.TMDB_API_KEY}&language=ar-SA&append_to_response=credits,images,external_ids`;
    const response = await fetch(TMDB_URL);
    if (!response.ok) {
      throw new Error('TMDB API Error');
    }
    const data = await response.json();
    
    // Cache on Edge for 24 hours
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate'); 
    res.status(200).json(data);
  } catch (error) {
    console.error('Metadata API Error:', error);
    res.status(500).json({ error: 'Failed to fetch metadata' });
  }
}
