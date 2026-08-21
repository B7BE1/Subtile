/**
 * lib/metadata/resolveMetadata.js
 * Orchestrates the full pipeline: resolve -> cache check -> live fetch ->
 * normalize -> persist -> return. This is the only place that knows about
 * ALL the other modules — everything else stays independently testable.
 *
 * Return shape (handler maps this to HTTP status):
 *   { state: "ok",        payload, stale: bool, degraded: bool }
 *   { state: "not_found" }
 *   { state: "unavailable" }
 */

import { resolveRequest, InvalidRequestError } from './resolve.js';
import * as cache from './cache.js';
import { coalesce } from './coalesce.js';
import { fetchCinemeta } from './sources/cinemeta.js';
import { fetchJikan, fetchJikanEpisodes } from './sources/jikan.js';
import { fetchAniList } from './sources/anilist.js';
import { normalizeCinemeta, normalizeJikan, normalizeAniList, mergeAnimeSources } from './normalize.js';
import { NotFoundError } from './httpUtil.js';
import { CircuitOpenError } from './breaker.js';

export { InvalidRequestError };

/**
 * Live-fetches + normalizes a movie/tv record via Cinemeta (no fallback).
 * @param {string} id imdb id
 * @param {"movie"|"tv"} type
 */
async function fetchAndNormalizeCinemeta(id, type) {
  const meta = await fetchCinemeta(id, type); // throws NotFoundError/UpstreamError
  return normalizeCinemeta(meta, type);
}

/**
 * Live-fetches + normalizes an anime record: Jikan primary, AniList fallback.
 * @param {string} id numeric mal/anilist id
 */
async function fetchAndNormalizeAnime(id) {
  let jikanRecord = null;
  let jikanFailed = false;

  try {
    const raw = await fetchJikan(id);
    // Movies have no episode listing on Jikan — skip the extra calls.
    // Best-effort: fetchJikanEpisodes never throws, so a failure here just
    // means episodes fall back to numbered placeholders, not a lost record.
    const episodeDetails = raw.type === 'Movie' ? [] : await fetchJikanEpisodes(id);
    jikanRecord = normalizeJikan(raw, episodeDetails);
  } catch (err) {
    // NotFoundError, CircuitOpenError, or UpstreamError — in every case we
    // still try AniList before giving up, since MAL/AniList ids don't
    // always map 1:1 and Jikan's rate limits make failures common.
    jikanFailed = true;
  }

  if (jikanRecord) return jikanRecord;

  try {
    const raw = await fetchAniList(id);
    const aniListRecord = normalizeAniList(raw);
    return mergeAnimeSources(jikanRecord, aniListRecord);
  } catch (err) {
    if (err instanceof NotFoundError && jikanFailed) {
      throw new NotFoundError('jikan+anilist', id);
    }
    throw err;
  }
}

/**
 * @param {string} id
 * @param {"movie"|"tv"|"anime"} type
 * @returns {Promise<object>} normalized payload
 */
async function fetchLive(id, type) {
  if (type === 'anime') {
    return fetchAndNormalizeAnime(id);
  }
  return fetchAndNormalizeCinemeta(id, type);
}

/**
 * Fire-and-forget background refresh for a stale-but-served cache entry.
 * Errors are logged, never thrown into the caller's response.
 */
function refreshInBackground(key, id, type) {
  coalesce(key, () => fetchLive(id, type))
    .then((payload) => cache.setCached(key, payload, cache.ttlForStatus(payload.content_status)))
    .catch((err) => {
      console.error(JSON.stringify({ source: 'background-refresh', error: err.message, key }));
    });
}

/**
 * @param {{ id: string, type: string }} params
 * @returns {Promise<{ state: string, payload?: object, stale?: boolean, degraded?: boolean }>}
 */
export async function resolveMetadata({ id: rawId, type: rawType }) {
  const { id, type } = resolveRequest({ id: rawId, type: rawType }); // throws InvalidRequestError

  const key = cache.buildKey(type, id);
  const cached = await cache.getCached(key);

  if (cached && cached.notFound) {
    return { state: 'not_found' };
  }

  if (cached && !cached.stale) {
    return { state: 'ok', payload: cached.payload, stale: false, degraded: false };
  }

  if (cached && cached.stale) {
    refreshInBackground(key, id, type);
    return { state: 'ok', payload: cached.payload, stale: true, degraded: false };
  }

  try {
    const payload = await coalesce(key, () => fetchLive(id, type));
    await cache.setCached(key, payload, cache.ttlForStatus(payload.content_status));
    return { state: 'ok', payload, stale: false, degraded: false };
  } catch (err) {
    if (err instanceof NotFoundError) {
      await cache.setNotFound(key, type);
      return { state: 'not_found' };
    }
    return { state: 'unavailable' };
  }
}

/**
 * Tests to add: full pipeline test with mocked sources for each of the
 * four terminal states (ok-fresh, ok-stale-triggers-background-refresh,
 * not_found sets negative cache, unavailable when live fetch fails with
 * no prior cache). A test asserting coalesce prevents a second fetchLive
 * call for concurrent requests on the same key.
 */
