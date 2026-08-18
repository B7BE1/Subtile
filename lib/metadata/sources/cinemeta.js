/**
 * lib/metadata/sources/cinemeta.js
 * Movie/TV metadata from Cinemeta (Stremio). No fallback source exists for
 * this type — resilience for movie/tv comes entirely from the cache layer.
 */

import { fetchWithTimeout, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';
import * as breaker from '../breaker.js';

const SOURCE = 'cinemeta';

/**
 * @param {string} imdbId e.g. "tt1234567"
 * @param {"movie"|"tv"} type
 * @returns {Promise<object>} raw Cinemeta meta object
 * @throws {NotFoundError|UpstreamError}
 */
export async function fetchCinemeta(imdbId, type) {
  const cinemetaType = type === 'tv' ? 'series' : 'movie';
  const url = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdbId}.json`;

  try {
    const response = await fetchWithTimeout(url);
    if (response.status === 404) {
      breaker.recordSuccess(SOURCE); // 404 is a valid, healthy response
      throw new NotFoundError(SOURCE, imdbId);
    }
    if (!response.ok) {
      breaker.recordFailure(SOURCE);
      throw new UpstreamError(SOURCE, `HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!data || !data.meta) {
      breaker.recordSuccess(SOURCE);
      throw new NotFoundError(SOURCE, imdbId);
    }
    breaker.recordSuccess(SOURCE);
    return data.meta;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    breaker.recordFailure(SOURCE);
    logSourceError(SOURCE, err, imdbId);
    throw err instanceof UpstreamError ? err : new UpstreamError(SOURCE, err.message);
  }
}

/**
 * Search Cinemeta's catalog (used by api/search.js). No fallback source for
 * this type — same resilience posture as fetchCinemeta.
 * @param {string} query
 * @param {"movie"|"series"} catalogType
 * @returns {Promise<Array<object>>} raw Cinemeta meta objects (may be empty)
 */
export async function searchCinemeta(query, catalogType) {
  if (breaker.isOpen(SOURCE)) return [];

  const url = `https://v3-cinemeta.strem.io/catalog/${catalogType}/top/search=${encodeURIComponent(query)}.json`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      breaker.recordFailure(SOURCE);
      return [];
    }
    const data = await response.json();
    breaker.recordSuccess(SOURCE);
    return data.metas || [];
  } catch (err) {
    breaker.recordFailure(SOURCE);
    logSourceError(SOURCE, err, query);
    return [];
  }
}

/**
 * Test to add: golden-file test with a captured real Cinemeta response,
 * asserting fetchCinemeta resolves to the expected raw meta shape; a
 * mocked-404 test asserting NotFoundError; a mocked-500 test asserting
 * UpstreamError and that breaker.recordFailure was invoked.
 */
