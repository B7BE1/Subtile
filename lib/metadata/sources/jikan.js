/**
 * lib/metadata/sources/jikan.js
 * Anime metadata from Jikan v4 (MyAnimeList). Primary anime source.
 * Respects the shared circuit breaker and a 3req/sec, 60req/min limiter.
 */

import { fetchWithTimeout, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';
import * as breaker from '../breaker.js';
import { CircuitOpenError, jikanLimiter } from '../breaker.js';

const SOURCE = 'jikan';

/**
 * @param {string} malId numeric MAL id (already stripped of "anime-" prefix)
 * @returns {Promise<object>} raw Jikan `data.data` object
 * @throws {NotFoundError|UpstreamError|CircuitOpenError}
 */
export async function fetchJikan(malId) {
  if (breaker.isOpen(SOURCE)) {
    throw new CircuitOpenError(SOURCE);
  }

  await jikanLimiter.acquire();

  const url = `https://api.jikan.moe/v4/anime/${malId}/full`;
  const attempt = async () => fetchWithTimeout(url);

  try {
    let response = await attempt();

    if (response.status === 429) {
      // one retry with jitter, per spec — Jikan's limits are tight
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
      await jikanLimiter.acquire();
      response = await attempt();
    }

    if (response.status === 404) {
      breaker.recordSuccess(SOURCE);
      throw new NotFoundError(SOURCE, malId);
    }
    if (!response.ok) {
      breaker.recordFailure(SOURCE);
      throw new UpstreamError(SOURCE, `HTTP ${response.status}`);
    }

    const json = await response.json();
    if (!json || !json.data) {
      breaker.recordSuccess(SOURCE);
      throw new NotFoundError(SOURCE, malId);
    }
    breaker.recordSuccess(SOURCE);
    return json.data;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    breaker.recordFailure(SOURCE);
    logSourceError(SOURCE, err, malId);
    throw err instanceof UpstreamError ? err : new UpstreamError(SOURCE, err.message);
  }
}

/**
 * Test to add: golden-file test with a captured real Jikan `/full` payload;
 * a 429-then-200 sequence test asserting the single retry path is taken;
 * a test asserting isOpen("jikan") short-circuits without any fetch call.
 */
