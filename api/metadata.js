/**
 * Serverless Metadata API (Cinemeta for Movies/Series + Jikan v4 for Anime)
 */

export default async function handler(req, res) {
  const { id, type = 'movie', provider } = req.query;

  if (!id) return res.status(400).json({ error: 'ID (IMDb ID for Movies/TV or MAL ID for Anime) is required' });

  const USER_AGENT = 'Subtile/1.0 (https://b7be.site)';

  try {
    // 1. Anime via Jikan API v4 + AniList GraphQL Fallback
    if (type === 'anime' || provider === 'jikan' || id.startsWith('anime-') || (!id.startsWith('tt') && !isNaN(id.replace('anime-', '')))) {
      const malId = id.replace('anime-', '');
      const jikanUrl = `https://api.jikan.moe/v4/anime/${malId}/full`;
      
      let a = null;
      try {
        let response;
        let retries = 2;
        while (retries >= 0) {
          response = await fetch(jikanUrl, {
            headers: { 'User-Agent': USER_AGENT }
          });
          if (response.ok) break;
          if (response.status === 429 && retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            retries--;
          } else {
            break;
          }
        }
        if (response && response.ok) {
          const json = await response.json();
          a = json.data;
        }
      } catch (e) {
        console.warn('Jikan fetch failed, trying AniList fallback:', e);
      }

      if (a) {
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
          genres: (a.genres || []).map(g => g.name),
          episodes: Array.from({length: a.episodes || 12}, (_, i) => ({season: 1, episode: i+1}))
        };

        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
        return res.status(200).json(metadata);
      }

      // AniList GraphQL Fallback (handles AniList IDs like 185874 or unindexed MAL entries)
      try {
        const numId = parseInt(malId, 10);
        const alQuery = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              idMal
              title { english romaji userPreferred }
              description
              bannerImage
              coverImage { extraLarge large }
              episodes
              genres
              averageScore
              seasonYear
              status
            }
          }
        `;
        const alRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: alQuery, variables: { id: numId } })
        });
        if (alRes.ok) {
          const alData = await alRes.json();
          if (alData?.data?.Media) {
            const m = alData.data.Media;
            const p = m.coverImage?.extraLarge || m.coverImage?.large || '';
            const bg = m.bannerImage || p;
            const cleanDesc = (m.description || '').replace(/<[^>]*>?/gm, '');
            const metadata = {
              id: `anime-${m.idMal || m.id}`,
              mal_id: m.idMal || m.id,
              title: m.title.english || m.title.romaji || m.title.userPreferred,
              japanese_title: m.title.romaji,
              year: m.seasonYear || null,
              type: 'anime',
              rating: m.averageScore ? parseFloat((m.averageScore / 10).toFixed(1)) : 8.0,
              episodes_count: m.episodes || 12,
              status: m.status,
              poster: p,
              backdrop: bg,
              overview: cleanDesc,
              genres: m.genres || ['Anime'],
              episodes: Array.from({length: m.episodes || 12}, (_, i) => ({season: 1, episode: i+1}))
            };
            res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
            return res.status(200).json(metadata);
          }
        }
      } catch (alErr) {
        console.error('AniList fallback error:', alErr);
      }
    }
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
