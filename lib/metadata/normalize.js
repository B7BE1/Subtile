/**
 * lib/metadata/normalize.js
 * Converts raw source payloads into the one shared metadata schema used
 * throughout the app, regardless of which source(s) answered.
 *
 * Shared schema:
 * {
 *   id, type, imdb_id, mal_id, title, original_title, japanese_title, year,
 *   content_status, rating, rating_source, poster, backdrop, overview, genres,
 *   episodes: [{ id, season, episode, episode_absolute, title, released }],
 *   sources
 * }
 */

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>?/gm, '');
}

/**
 * @param {object} meta raw Cinemeta meta object
 * @param {"movie"|"tv"} type
 * @returns {object} normalized record
 */
export function normalizeCinemeta(meta, type) {
  const poster = meta.poster || '';
  const backdrop = meta.background || poster; // never ship an empty backdrop

  // Cinemeta's videos array can include season 0 (specials) — kept as-is,
  // tagged with their real season number rather than filtered.
  const episodes = (meta.videos || []).map((v) => ({
    id: v.id || null,
    season: v.season ?? null,
    episode: v.episode || v.number || null,
    episode_absolute: v.episode || v.number || null,
    title: v.title || `Episode ${v.episode || v.number || ''}`.trim(),
    released: v.released || null,
  }));

  return {
    id: meta.imdb_id || meta.id,
    type,
    imdb_id: meta.imdb_id || meta.id || null,
    mal_id: null,
    title: meta.name || meta.title || '',
    original_title: meta.name || meta.title || '',
    japanese_title: null,
    year: parseInt(meta.year, 10) || parseInt((meta.releaseInfo || '').slice(0, 4), 10) || null,
    content_status: meta.status === 'Continuing' ? 'airing' : 'released',
    rating: parseFloat(meta.imdbRating) || 0,
    rating_source: 'cinemeta',
    poster,
    backdrop,
    overview: meta.description || '',
    genres: meta.genres || [],
    episodes,
    sources: ['cinemeta'],
  };
}

/**
 * @param {object} a raw Jikan `data.data` object
 * @returns {object} normalized record
 */
export function normalizeJikan(a) {
  const poster = a.images?.webp?.large_image_url || a.images?.jpg?.large_image_url || '';
  const backdrop = a.trailer?.images?.maximum_image_url || poster;

  const year = a.year || a.aired?.prop?.from?.year || null;
  const episodeCount = a.episodes || 0;

  // Branch on Jikan's `type` field — a Movie doesn't get a full episodes[]
  // the same way a TV/OVA/ONA series does.
  let episodes = [];
  if (a.type === 'Movie') {
    episodes = episodeCount
      ? [{ id: null, season: 1, episode: 1, episode_absolute: 1, title: a.title, released: a.aired?.from || null }]
      : [];
  } else {
    // TV / OVA / ONA / Special — episode_absolute mirrors episode for now.
    // KNOWN LIMITATION: Jikan doesn't provide season splits for long-running
    // series (e.g. One Piece); absolute vs in-season numbering isn't
    // derivable from this API alone. Revisit if subtitle matching needs it.
    episodes = Array.from({ length: episodeCount || 12 }, (_, i) => ({
      id: null,
      season: 1,
      episode: i + 1,
      episode_absolute: i + 1,
      title: null,
      released: null,
    }));
  }

  const statusMap = {
    'Currently Airing': 'airing',
    'Finished Airing': 'ended',
    'Not yet aired': 'upcoming',
  };

  return {
    id: `anime-${a.mal_id}`,
    type: 'anime',
    imdb_id: null,
    mal_id: a.mal_id,
    title: a.title_english || a.title,
    original_title: a.title,
    japanese_title: a.title_japanese || null,
    year,
    content_status: statusMap[a.status] || 'ended',
    rating: parseFloat(a.score) || 0,
    rating_source: 'jikan',
    poster,
    backdrop,
    overview: a.synopsis || '',
    genres: (a.genres || []).map((g) => g.name),
    episodes,
    // normalized/lowercased searchable titles, stored at write time so future
    // fuzzy search doesn't need to hit Jikan live.
    search_titles: [a.title, a.title_english, ...(a.title_synonyms || [])]
      .filter(Boolean)
      .map((t) => t.toLowerCase()),
    sources: ['jikan'],
  };
}

/**
 * @param {object} m raw AniList Media object
 * @returns {object} normalized record
 */
export function normalizeAniList(m) {
  const poster = m.coverImage?.extraLarge || m.coverImage?.large || '';
  const backdrop = m.bannerImage || poster;
  const episodeCount = m.episodes || 0;

  const statusMap = {
    RELEASING: 'airing',
    FINISHED: 'ended',
    NOT_YET_RELEASED: 'upcoming',
  };

  const episodes =
    m.format === 'MOVIE'
      ? [{ id: null, season: 1, episode: 1, episode_absolute: 1, title: null, released: null }]
      : Array.from({ length: episodeCount || 12 }, (_, i) => ({
          id: null,
          season: 1,
          episode: i + 1,
          episode_absolute: i + 1,
          title: null,
          released: null,
        }));

  return {
    id: `anime-${m.idMal || m.id}`,
    type: 'anime',
    imdb_id: null,
    mal_id: m.idMal || m.id,
    title: m.title?.english || m.title?.romaji || m.title?.userPreferred,
    original_title: m.title?.romaji || null,
    japanese_title: m.title?.romaji || null,
    year: m.seasonYear || null,
    content_status: statusMap[m.status] || 'ended',
    rating: m.averageScore ? parseFloat((m.averageScore / 10).toFixed(1)) : 0,
    rating_source: 'anilist',
    poster,
    backdrop,
    overview: stripHtml(m.description),
    genres: m.genres || [],
    episodes,
    search_titles: [m.title?.english, m.title?.romaji, m.title?.userPreferred]
      .filter(Boolean)
      .map((t) => t.toLowerCase()),
    sources: ['anilist'],
  };
}

/**
 * Merges a Jikan-normalized record with an AniList-normalized record when
 * both contributed data. Jikan wins for score/episode_count; AniList wins
 * for description/banner only when Jikan's equivalent field is empty.
 * @param {object} jikanRecord
 * @param {object} aniListRecord
 * @returns {object}
 */
export function mergeAnimeSources(jikanRecord, aniListRecord) {
  if (!jikanRecord) return aniListRecord;
  if (!aniListRecord) return jikanRecord;

  return {
    ...jikanRecord,
    overview: jikanRecord.overview || aniListRecord.overview,
    backdrop: jikanRecord.backdrop || aniListRecord.backdrop,
    japanese_title: jikanRecord.japanese_title || aniListRecord.japanese_title,
    sources: [...new Set([...jikanRecord.sources, ...aniListRecord.sources])],
  };
}

/**
 * Tests to add: golden-file test per normalize* function using a captured
 * real payload, asserting the exact normalized output object. A separate
 * test for mergeAnimeSources covering "Jikan only", "AniList only", and
 * "both, AniList fills empty overview" cases.
 */
