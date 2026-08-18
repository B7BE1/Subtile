/**
 * Serverless Metadata API (Cinemeta for Movies/Series + Jikan v4 for Anime)
 */

export default async function handler(req, res) {
  const { id, type = 'movie', provider } = req.query;

  if (!id) return res.status(400).json({ error: 'ID (IMDb ID for Movies/TV or MAL ID for Anime) is required' });

  const USER_AGENT = 'Subtile/1.0 (https://b7be.site)';

  try {
    // 1. Anime via Jikan API v4
    if (type === 'anime' || provider === 'jikan' || id.startsWith('anime-') || !isNaN(id)) {
      const malId = id.replace('anime-', '');
      const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}/full`;
      
      const response = await fetch(jikanUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });
      
      if (!response.ok) throw new Error(`Jikan API Error: ${response.statusText}`);
      const json = await response.json();
      const a = json.data;

      const metadata = {
        id: `anime-${a.mal_id}`,
        mal_id: a.mal_id,
        title: a.title_english || a.title,
        japanese_title: a.title_japanese,
        year: a.year || (a.aired && a.aired.prop && a.aired.prop.from ? a.aired.prop.from.year : null),
        type: 'anime',
        rating: parseFloat(a.score) || 0,
        episodes_count: a.episodes || 0,
        status: a.status,
        poster: (a.images && a.images.webp && a.images.webp.large_image_url) || (a.images && a.images.jpg && a.images.jpg.large_image_url) || '',
        backdrop: (a.trailer && a.trailer.images && a.trailer.images.maximum_image_url) || '',
        overview: a.synopsis || '',
        genres: (a.genres || []).map(g => g.name)
      };

      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json(metadata);
    }

    // 2. Movies & TV Shows via Cinemeta API (Stremio / IMDb)
    const cinemetaType = (type === 'tv' || type === 'series') ? 'series' : 'movie';
    const cinemetaUrl = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${id}.json`;

    const response = await fetch(cinemetaUrl, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!response.ok) throw new Error(`Cinemeta API Error: ${response.statusText}`);
    const data = await response.json();
    const meta = data.meta;

    if (!meta) throw new Error('Title not found on Cinemeta');

    const metadata = {
      id: meta.imdb_id || id,
      title: meta.name || meta.title,
      year: parseInt(meta.year) || parseInt((meta.releaseInfo || '').substring(0, 4)) || null,
      type: cinemetaType === 'series' ? 'tv' : 'movie',
      rating: parseFloat(meta.imdbRating) || 0,
      poster: meta.poster || '',
      backdrop: meta.background || '',
      imdb_id: meta.imdb_id || id,
      overview: meta.description || '',
      genres: meta.genres || [],
      episodes: (meta.videos || []).map(v => ({
        id: v.id,
        season: v.season,
        episode: v.episode || v.number,
        title: v.title || `Episode ${v.episode || v.number}`,
        released: v.released || ''
      }))
    };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(metadata);

  } catch (error) {
    console.error('Metadata API Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch metadata' });
  }
}
