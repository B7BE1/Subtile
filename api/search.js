/**
 * Subtile - Hybrid Search Serverless API
 * Searches both local Supabase database and TMDB API.
 */

export default async function handler(req, res) {
  const { query, type = 'multi' } = req.query;

  if (!query) return res.status(400).json({ error: 'Query is required' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  const tmdbKey = process.env.TMDB_API_KEY;

  let combinedResults = [];

  // 1. Search local Supabase database if credentials exist
  if (supabaseUrl && supabaseKey) {
    try {
      const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      };
      const sbRes = await fetch(
        `${supabaseUrl}/rest/v1/media_titles?or=(title.ilike.*${encodeURIComponent(query)}*,arabic_title.ilike.*${encodeURIComponent(query)}*)&limit=10`,
        { headers }
      );
      if (sbRes.ok) {
        const localRows = await sbRes.json();
        if (Array.isArray(localRows)) {
          combinedResults = localRows.map(row => ({
            id: row.tmdb_id || row.id,
            title: row.title,
            arabic_title: row.arabic_title,
            type: row.type,
            year: row.year ? String(row.year) : '',
            rating: row.rating ? Number(row.rating).toFixed(1) : '8.5',
            poster_path: row.poster,
            overview: row.overview || '',
            source: 'local_db'
          }));
        }
      }
    } catch (e) {
      console.warn('Supabase local search warning:', e.message);
    }
  }

  // 2. Search TMDB API
  if (tmdbKey) {
    try {
      const searchType = type === 'all' ? 'multi' : type;
      const TMDB_URL = `https://api.themoviedb.org/3/search/${searchType}?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&language=ar-SA`;
      const response = await fetch(TMDB_URL);
      
      if (response.ok) {
        const tmdbData = await response.json();
        const tmdbResults = tmdbData.results || [];
        
        // Merge without duplicates by TMDB ID
        const existingIds = new Set(combinedResults.map(r => String(r.id)));
        for (const item of tmdbResults) {
          if (!existingIds.has(String(item.id))) {
            combinedResults.push(item);
          }
        }
      }
    } catch (error) {
      console.error('TMDB Search API Error:', error);
    }
  }

  // Set Edge Cache (1 hour)
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json({ results: combinedResults });
}
