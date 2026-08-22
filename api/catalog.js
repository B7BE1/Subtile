/**
 * api/catalog.js
 * High-performance, server-side paginated catalog endpoint.
 * Combines full libraries from Cinemeta (Movies & Series) and Jikan (Anime)
 * with server caching, eliminating client-side CORS or ad-blocker issues.
 */

const CACHE = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minutes Cache

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  const type = (req.query.type || 'all').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const cacheKey = `${type}_p${page}`;

  const cached = CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.ts < CACHE_TTL_MS)) {
    return res.status(200).json(cached.data);
  }

  const skip = (page - 1) * 50;
  const promises = [];

  // 1. Fetch Movies (Cinemeta Top Catalog)
  if (type === 'all' || type === 'movie') {
    const movieUrl = skip === 0
      ? 'https://v3-cinemeta.strem.io/catalog/movie/top.json'
      : `https://v3-cinemeta.strem.io/catalog/movie/top/skip=${skip}.json`;

    promises.push(
      fetch(movieUrl)
        .then(r => r.ok ? r.json() : { metas: [] })
        .then(d => (d.metas || []).map(m => ({
          id: m.imdb_id || m.id,
          title: m.name,
          type: 'movie',
          year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
          rating: parseFloat(m.imdbRating) || 0,
          poster: m.poster || `https://images.metahub.space/poster/small/${m.id}/img`,
          downloads: `${(Math.random() * 2 + 2.5).toFixed(1)}M`
        })))
        .catch(() => [])
    );
  }

  // 2. Fetch Series (Cinemeta Top Catalog)
  if (type === 'all' || type === 'tv' || type === 'series') {
    const tvUrl = skip === 0
      ? 'https://v3-cinemeta.strem.io/catalog/series/top.json'
      : `https://v3-cinemeta.strem.io/catalog/series/top/skip=${skip}.json`;

    promises.push(
      fetch(tvUrl)
        .then(r => r.ok ? r.json() : { metas: [] })
        .then(d => (d.metas || []).map(s => ({
          id: s.imdb_id || s.id,
          title: s.name,
          type: 'tv',
          year: (s.releaseInfo || s.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
          rating: parseFloat(s.imdbRating) || 0,
          poster: s.poster || `https://images.metahub.space/poster/small/${s.id}/img`,
          downloads: `${(Math.random() * 2 + 2.0).toFixed(1)}M`
        })))
        .catch(() => [])
    );
  }

  // 3. Fetch Anime (Jikan MAL Top Anime)
  if (type === 'all' || type === 'anime') {
    promises.push(
      fetch(`https://api.jikan.moe/v4/top/anime?page=${page}&limit=25`)
        .then(r => r.ok ? r.json() : { data: [] })
        .then(d => (d.data || []).map(a => ({
          id: `anime-${a.mal_id}`,
          title: a.title_english || a.title,
          type: 'anime',
          year: a.year || (a.aired?.from ? new Date(a.aired.from).getFullYear() : 'N/A'),
          rating: a.score || 8.5,
          poster: a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || '',
          downloads: `${(Math.random() * 2 + 2.2).toFixed(1)}M`
        })))
        .catch(() => [])
    );
  }

  try {
    const settled = await Promise.all(promises);
    const results = settled.flat();

    const payload = {
      page,
      type,
      count: results.length,
      hasMore: results.length > 0,
      results
    };

    CACHE.set(cacheKey, { ts: Date.now(), data: payload });
    return res.status(200).json(payload);
  } catch (error) {
    console.error('Catalog API Error:', error);
    return res.status(500).json({ error: 'Failed to fetch catalog', results: [] });
  }
}
