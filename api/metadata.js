/**
 * Metadata API - Resolves metadata from Cinemeta (Movies/Series) and Jikan (Anime)
 */

export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID parameter is required' });
  }

  const USER_AGENT = 'Subtile/1.0 (https://b7be.site)';

  try {
    // 1. Anime from Kitsu API
    if (type === 'anime' || id.startsWith('anime-') || (!id.startsWith('tt') && !isNaN(id))) {
      const kitsuId = id.replace('anime-', '');
      const kitsuRes = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/vnd.api+json' }
      });

      if (!kitsuRes.ok) {
        throw new Error(`Kitsu API responded with status ${kitsuRes.status}`);
      }

      const kitsuData = await kitsuRes.json();
      const attrs = kitsuData.data.attributes;

      const posterUrl = (attrs.posterImage && (attrs.posterImage.large || attrs.posterImage.original)) || '';
      const bgUrl = (attrs.coverImage && attrs.coverImage.large) || posterUrl;

      // Generate episodes array
      const episodesCount = attrs.episodeCount || 12;
      const episodes = [];
      for (let i = 1; i <= episodesCount; i++) {
        episodes.push({
          season: 1,
          episode: i,
          title: `Episode ${i}`
        });
      }

      const result = {
        id: `anime-${kitsuData.data.id}`,
        mal_id: kitsuData.data.id,
        title: attrs.titles ? (attrs.titles.en || attrs.titles.en_us || attrs.canonicalTitle) : attrs.canonicalTitle,
        original_title: attrs.titles ? attrs.titles.ja_jp : '',
        year: attrs.startDate ? attrs.startDate.split('-')[0] : null,
        type: 'anime',
        rating: attrs.averageRating ? parseFloat((attrs.averageRating / 10).toFixed(1)) : 8.5,
        poster: posterUrl,
        backdrop: bgUrl,
        overview: attrs.synopsis || '',
        genres: ['Anime'],
        status: attrs.status,
        episodes: episodes,
        seasonsCount: 1
      };

      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
      return res.status(200).json(result);
    }

    // 2. Movies & Series from Cinemeta API
    const imdbId = id.startsWith('tt') ? id : `tt${id}`;
    const mediaType = (type === 'tv' || type === 'series') ? 'series' : 'movie';

    // Fetch from Cinemeta
    let cinemetaRes = await fetch(`https://v3-cinemeta.strem.io/meta/${mediaType}/${imdbId}.json`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    // If not found in primary type, try alternative (e.g. series instead of movie)
    let cinemetaData;
    if (cinemetaRes.ok) {
      cinemetaData = await cinemetaRes.json();
    }
    
    if (!cinemetaData || !cinemetaData.meta) {
      const altType = mediaType === 'movie' ? 'series' : 'movie';
      const altRes = await fetch(`https://v3-cinemeta.strem.io/meta/${altType}/${imdbId}.json`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (altRes.ok) {
        cinemetaData = await altRes.json();
      }
    }

    if (!cinemetaData || !cinemetaData.meta) {
      return res.status(404).json({ error: 'Metadata not found on Cinemeta' });
    }

    const m = cinemetaData.meta;
    const episodes = (m.videos || []).map(v => ({
      season: v.season,
      episode: v.episode || v.number,
      title: v.name || v.title || `Episode ${v.episode || v.number}`,
      released: v.released
    }));

    const rawYear = m.releaseInfo || m.year || '';
    const year = rawYear.toString().split(/[-–]/)[0].trim() || null;
    const posterUrl = m.poster || `https://images.metahub.space/poster/small/${m.id}/img`;
    const bgUrl = m.background || `https://images.metahub.space/background/medium/${m.id}/img`;

    const result = {
      id: m.id || imdbId,
      imdb_id: m.imdb_id || m.id || imdbId,
      title: m.name,
      year: year,
      releaseInfo: rawYear,
      type: m.type === 'series' ? 'tv' : 'movie',
      rating: parseFloat(m.imdbRating) || 8.0,
      poster: posterUrl,
      backdrop: bgUrl,
      overview: m.description || m.overview || '',
      genres: m.genres || [],
      episodes: episodes,
      seasonsCount: episodes.length > 0 ? Math.max(...episodes.map(e => e.season || 1)) : 1
    };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json(result);

  } catch (error) {
    console.error('Metadata API Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch metadata' });
  }
}
