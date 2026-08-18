/**
 * lib/metadata/sources/anilist.js
 * Anime metadata from AniList GraphQL. Used ONLY as a fallback when Jikan
 * fails, 404s, or its circuit breaker is open — never called as a co-primary.
 *
 * IMPORTANT: this module is always called with a MyAnimeList id (the app's
 * canonical anime id is `anime-${mal_id}`, stripped to the numeric MAL id by
 * resolve.js before reaching here — see normalize.js's `id: anime-${mal_id}`
 * convention). AniList's `Media(id: ...)` argument is AniList's OWN internal
 * id, a different numbering scheme from MAL's — querying by `id` with a MAL
 * id would silently return the wrong anime (or a random/unrelated one)
 * whenever the numbers happen to collide. AniList exposes `idMal` precisely
 * for this cross-reference case, so that's what must be used here.
 */

import { fetchWithTimeout, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';

const SOURCE = 'anilist';

const QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
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
      format
    }
  }
`;

/**
 * @param {string|number} malId MyAnimeList numeric id
 * @returns {Promise<object>} raw AniList Media object
 * @throws {NotFoundError|UpstreamError}
 */
export async function fetchAniList(malId) {
  const numId = parseInt(malId, 10);
  try {
    const response = await fetchWithTimeout('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { idMal: numId } }),
    });

    if (!response.ok) {
      throw new UpstreamError(SOURCE, `HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!json?.data?.Media) {
      throw new NotFoundError(SOURCE, malId);
    }
    return json.data.Media;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    logSourceError(SOURCE, err, malId);
    throw err instanceof UpstreamError ? err : new UpstreamError(SOURCE, err.message);
  }
}

/**
 * Test to add: golden-file test with a captured real AniList Media payload
 * fetched by idMal; a not-found test asserting NotFoundError when
 * data.Media is null; a regression test asserting the query variable is
 * named idMal (not id) so this bug can't silently come back.
 */
