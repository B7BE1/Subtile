/**
 * lib/metadata/sources/anilist.js
 * Anime metadata from AniList GraphQL. Used ONLY as a fallback when Jikan
 * fails, 404s, or its circuit breaker is open — never called as a co-primary.
 */

import { fetchWithTimeout, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';

const SOURCE = 'anilist';

const QUERY = `
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
      format
    }
  }
`;

/**
 * @param {string|number} id AniList or MAL numeric id
 * @returns {Promise<object>} raw AniList Media object
 * @throws {NotFoundError|UpstreamError}
 */
export async function fetchAniList(id) {
  const numId = parseInt(id, 10);
  try {
    const response = await fetchWithTimeout('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { id: numId } }),
    });

    if (!response.ok) {
      throw new UpstreamError(SOURCE, `HTTP ${response.status}`);
    }
    const json = await response.json();
    if (!json?.data?.Media) {
      throw new NotFoundError(SOURCE, id);
    }
    return json.data.Media;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    logSourceError(SOURCE, err, id);
    throw err instanceof UpstreamError ? err : new UpstreamError(SOURCE, err.message);
  }
}

/**
 * Test to add: golden-file test with a captured real AniList Media payload;
 * a not-found test asserting NotFoundError when data.Media is null.
 */
