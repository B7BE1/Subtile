/**
 * Universal Search API (Cinemeta for Movies/Series + Jikan for Anime)
 * Smart ranking, exact match prioritization, and full year & image extraction.
 */

export default async function handler(req, res) {
  const { q, type = 'all' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  const cleanQ = q.trim().toLowerCase();
  const USER_AGENT = 'Subtile/1.0 (https://b7be.site)';

  try {
    const searchPromises = [];

    // 1. Search Cinemeta Series
    if (type === 'all' || type === 'tv' || type === 'series') {
      const pSeries = fetch(`https://v3-cinemeta.strem.io/catalog/series/top/search=${encodeURIComponent(cleanQ)}.json`, {
        headers: { 'User-Agent': USER_AGENT }
      })
      .then(r => r.ok ? r.json() : { metas: [] })
      .then(d => (d.metas || []).map(m => {
        const rawYear = m.releaseInfo || m.year || '';
        const year = rawYear.toString().split(/[-–]/)[0].trim() || null;
        const posterUrl = m.poster || `https://images.metahub.space/poster/small/${m.id}/img`;
        const bgUrl = m.background || `https://images.metahub.space/background/medium/${m.id}/img`;

        return {
          id: m.imdb_id || m.id,
          imdb_id: m.imdb_id || m.id,
          title: m.name,
          year: year || null,
          releaseInfo: rawYear,
          type: 'tv',
          rating: parseFloat(m.imdbRating) || 8.5,
          poster: posterUrl,
          backdrop: bgUrl,
          genres: m.genres || ['TV Series']
        };
      }))
      .catch(() => []);
      searchPromises.push(pSeries);
    }

    // 2. Search Cinemeta Movies
    if (type === 'all' || type === 'movie') {
      const pMovie = fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/search=${encodeURIComponent(cleanQ)}.json`, {
        headers: { 'User-Agent': USER_AGENT }
      })
      .then(r => r.ok ? r.json() : { metas: [] })
      .then(d => (d.metas || []).map(m => {
        const rawYear = m.releaseInfo || m.year || '';
        const year = rawYear.toString().split(/[-–]/)[0].trim() || null;
        const posterUrl = m.poster || `https://images.metahub.space/poster/small/${m.id}/img`;
        const bgUrl = m.background || `https://images.metahub.space/background/medium/${m.id}/img`;

        return {
          id: m.imdb_id || m.id,
          imdb_id: m.imdb_id || m.id,
          title: m.name,
          year: year || null,
          releaseInfo: rawYear,
          type: 'movie',
          rating: parseFloat(m.imdbRating) || 8.0,
          poster: posterUrl,
          backdrop: bgUrl,
          genres: m.genres || ['Movie']
        };
      }))
      .catch(() => []);
      searchPromises.push(pMovie);
    }

    // 3. Search Jikan Anime
    if (type === 'all' || type === 'anime') {
      const pAnime = fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(cleanQ)}&limit=8`, {
        headers: { 'User-Agent': USER_AGENT }
      })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => (d.data || []).map(a => {
        const posterUrl = (a.images && a.images.webp && a.images.webp.large_image_url) || (a.images && a.images.jpg && a.images.jpg.large_image_url) || '';
        const bgUrl = (a.trailer && a.trailer.images && (a.trailer.images.maximum_image_url || a.trailer.images.large_image_url)) || posterUrl;

        return {
          id: `anime-${a.mal_id}`,
          mal_id: a.mal_id,
          title: a.title_english || a.title,
          year: a.year || (a.aired && a.aired.prop && a.aired.prop.from ? a.aired.prop.from.year : null),
          type: 'anime',
          rating: parseFloat(a.score) || 8.0,
          poster: posterUrl,
          backdrop: bgUrl,
          genres: (a.genres || []).map(g => g.name)
        };
      }))
      .catch(() => []);
      searchPromises.push(pAnime);
    }

    const settled = await Promise.all(searchPromises);
    let results = settled.flat();

    // Intelligent Sorting: Exact match first, then by popularity/match quality
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase() === cleanQ ? 1 : 0;
      const bExact = b.title.toLowerCase() === cleanQ ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const aStarts = a.title.toLowerCase().startsWith(cleanQ) ? 1 : 0;
      const bStarts = b.title.toLowerCase().startsWith(cleanQ) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      return (b.rating || 0) - (a.rating || 0);
    });

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ query: q, count: results.length, results });

  } catch (error) {
    console.error('Search API Error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}
