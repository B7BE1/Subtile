/**
 * lib/metadata/sources/cinemeta.js
 * Movie/TV metadata from Cinemeta (Stremio). No fallback source exists for
 * this type — resilience for movie/tv comes entirely from the cache layer.
 */

import { fetchWithTimeout, fetchWithRetry, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';
import * as breaker from '../breaker.js';
import { CircuitOpenError } from '../breaker.js';

const SOURCE = 'cinemeta';

/**
 * @param {string} imdbId e.g. "tt1234567"
 * @param {"movie"|"tv"} type
 * @returns {Promise<object>} raw Cinemeta meta object
 * @throws {NotFoundError|UpstreamError|CircuitOpenError}
 */
export async function fetchCinemeta(imdbId, type) {
  if (breaker.isOpen(SOURCE)) {
    throw new CircuitOpenError(SOURCE);
  }

  const cinemetaType = type === 'tv' ? 'series' : 'movie';
  const url = `https://v3-cinemeta.strem.io/meta/${cinemetaType}/${imdbId}.json`;

  try {
    // Detail lookups are on the user-facing critical path and Cinemeta has
    // no fallback source, so a transient blip (network error / 5xx) gets
    // one retry here rather than immediately degrading the response.
    const response = await fetchWithRetry(url);
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
 * mocked-404 test asserting NotFoundError; a mocked-500-then-200 test
 * asserting the fetchWithRetry retry path succeeds; a mocked-500-then-500
 * test asserting UpstreamError and that breaker.recordFailure was invoked;
 * a test asserting isOpen("cinemeta") short-circuits with CircuitOpenError
 * before any fetch call.
 */
