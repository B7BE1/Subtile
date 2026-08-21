/**
 * lib/metadata/sources/jikan.js
 * Anime metadata from Jikan v4 (MyAnimeList). Primary anime source.
 * Respects the shared circuit breaker and a 3req/sec, 60req/min limiter.
 */

import { fetchWithTimeout, NotFoundError, UpstreamError, logSourceError } from '../httpUtil.js';
import * as breaker from '../breaker.js';
import { CircuitOpenError, jikanLimiter } from '../breaker.js';

const SOURCE = 'jikan';
const MAX_EPISODE_PAGES = 5; // Jikan pages episodes 100/page; caps the rate-limit
// budget one resolve can spend on very long-running shows (One Piece, etc.)

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

    // One retry, through the limiter, for both a 429 (tight Jikan quota) and
    // a transient 5xx — previously only 429 was retried, so a momentary
    // upstream blip fell straight through to UpstreamError.
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      const jitterMs = response.status === 429 ? 1000 + Math.random() * 500 : 500 + Math.random() * 300;
      await new Promise((r) => setTimeout(r, jitterMs));
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
 * Fetches real per-episode titles/air-dates from Jikan's paginated episode
 * list (`/anime/{id}/episodes`) — separate from `/full`, which only carries
 * an episode *count*. Best-effort: never throws, returns whatever pages
 * were collected before any failure so a partial result still beats none.
 * Skip calling this for `type === "Movie"` records — Jikan has no episode
 * listing for movies.
 * @param {string} malId numeric MAL id
 * @returns {Promise<Array<{episode: number, title: string|null, title_japanese: string|null, aired: string|null, filler: boolean, recap: boolean}>>}
 */
export async function fetchJikanEpisodes(malId) {
  if (breaker.isOpen(SOURCE)) return [];

  async function fetchPage(page) {
    await jikanLimiter.acquire();
    const url = `https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`;
    let response = await fetchWithTimeout(url);
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
      await jikanLimiter.acquire();
      response = await fetchWithTimeout(url);
    }
    return response;
  }

  const episodes = [];
  try {
    for (let page = 1; page <= MAX_EPISODE_PAGES; page++) {
      const response = await fetchPage(page);

      if (response.status === 404) {
        breaker.recordSuccess(SOURCE); // no episode listing for this title — not an error
        break;
      }
      if (!response.ok) {
        breaker.recordFailure(SOURCE);
        break; // best-effort: keep whatever pages already succeeded
      }

      const json = await response.json();
      breaker.recordSuccess(SOURCE);
      for (const ep of json.data || []) {
        episodes.push({
          episode: ep.mal_id,
          title: ep.title || null,
          title_japanese: ep.title_japanese || null,
          aired: ep.aired || null,
          filler: !!ep.filler,
          recap: !!ep.recap,
        });
      }
      if (!json.pagination?.has_next_page) break;
    }
  } catch (err) {
    breaker.recordFailure(SOURCE);
    logSourceError(SOURCE, err, malId);
  }
  return episodes;
}

/**
 * Search Jikan's anime catalog by title (used by api/search.js). Returns []
 * on any failure rather than throwing — search is best-effort across
 * multiple sources, one failing source shouldn't fail the whole request.
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<Array<object>>} raw Jikan anime objects (may be empty)
 */
export async function searchJikanByQuery(query, limit = 8) {
  if (breaker.isOpen(SOURCE)) return [];

  try {
    await jikanLimiter.acquire();
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      breaker.recordFailure(SOURCE);
      return [];
    }
    const json = await response.json();
    breaker.recordSuccess(SOURCE);
    return json.data || [];
  } catch (err) {
    breaker.recordFailure(SOURCE);
    logSourceError(SOURCE, err, query);
    return [];
  }
}

/**
 * Test to add: golden-file test with a captured real Jikan `/full` payload;
 * a 429-then-200 sequence test asserting the single retry path is taken;
 * a 500-then-200 sequence test asserting the retry path also covers 5xx;
 * a test asserting isOpen("jikan") short-circuits without any fetch call;
 * for fetchJikanEpisodes: a 2-page sequence test asserting pagination stops
 * at has_next_page:false; a test asserting it stops at MAX_EPISODE_PAGES
 * for a long-running show; a mid-pagination-failure test asserting the
 * pages collected before the failure are still returned.
 */
