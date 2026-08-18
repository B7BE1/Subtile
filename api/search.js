/**
 * api/search.js
 * Universal Search API (Cinemeta for Movies/Series + Jikan for Anime)
 * Reuses the same source modules and normalized schema as api/metadata.js
 * (lib/metadata/*) so search results and detail-page results never
 * disagree in shape.
 *
 * Resilience posture: searchCinemeta/searchJikanByQuery already never
 * throw (breaker.js + fetchWithTimeout inside each source module resolve
 * to [] on any failure) — see lib/metadata/sources/*.js. This handler adds
 * a second layer via Promise.allSettled anyway, so a future source that
 * *does* throw still can't take down the whole request, and reports which
 * sources actually answered in `meta.sources` for observability.
 *
 * Response contract (unchanged, additive only): { query, count, results }
 * where `results` is a flat, ranked array — js/app.js and js/browse.js
 * dedup/merge against this shape directly, so it is not restructured here.
 */

import { searchCinemeta } from '../lib/metadata/sources/cinemeta.js';
import { searchJikanByQuery } from '../lib/metadata/sources/jikan.js';
import { normalizeCinemetaSearchResult, normalizeJikanSearchResult } from '../lib/metadata/normalize.js';

const VALID_TYPES = new Set(['all', 'movie', 'tv', 'series', 'anime']);
const MIN_QUERY_LENGTH = 1;
const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;
const JIKAN_LIMIT = 8;

/**
 * Relevance score for a single result against the raw query. Higher wins.
 * Cheap on purpose — this runs over every result on every request, no
 * external calls, no fuzzy-match library.
 * @param {{title?: string}} result
 * @param {string} qLower already-lowercased query
 * @returns {number}
 */
function relevanceScore(result, qLower) {
  const title = (result.title || '').toLowerCase();
  if (!title) return 0;

  let score;
  if (title === qLower) score = 100;
  else if (title.startsWith(qLower)) score = 80;
  else if (title.split(/\s+/).some((word) => word.startsWith(qLower))) score = 60;
  else if (title.includes(qLower)) score = 40;
  else score = 10; // source matched it on something we can't see (synonyms, original title, etc.)

  // Small tiebreaker so, e.g., two exact-title matches rank by popularity.
  return score + Math.min(result.rating || 0, 10) / 10;
}

/**
 * @param {Array<object>} results
 * @param {string} query
 * @returns {Array<object>}
 */
function rankAndDedupe(results, query) {
  const qLower = query.toLowerCase();
  const seen = new Set();
  const deduped = [];

  for (const r of results) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  return deduped
    .map((r) => ({ r, score: relevanceScore(r, qLower) }))
    .sort((a, b) => b.score - a.score)
    .map(({ r }) => r);
}

/**
 * Runs one source search and reports success/failure without ever
 * rejecting, so a caller can Promise.all the wrapped calls safely.
 * @param {string} label used in meta.sources and error logs
 * @param {() => Promise<Array<object>>} run
 * @returns {Promise<{ label: string, status: 'ok'|'error', results: Array<object> }>}
 */
async function runSource(label, run) {
  try {
    const results = await run();
    return { label, status: 'ok', results };
  } catch (error) {
    console.error(JSON.stringify({ source: label, error: error.message }));
    return { label, status: 'error', results: [] };
  }
}

export default async function handler(req, res) {
  const { q, type = 'all', limit } = req.query;

  const query = typeof q === 'string' ? q.trim() : '';
  if (query.length < MIN_QUERY_LENGTH) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({ error: `Search query must be ${MAX_QUERY_LENGTH} characters or fewer` });
  }

  const normalizedType = VALID_TYPES.has(type) ? type : 'all';
  const parsedLimit = Number(limit);
  const resultLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(Math.floor(parsedLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  const jobs = [];

  if (normalizedType === 'all' || normalizedType === 'movie') {
    jobs.push(
      runSource('cinemeta-movie', async () => {
        const metas = await searchCinemeta(query, 'movie');
        return metas.map((m) => normalizeCinemetaSearchResult(m, 'movie'));
      })
    );
  }

  if (normalizedType === 'all' || normalizedType === 'tv' || normalizedType === 'series') {
    jobs.push(
      runSource('cinemeta-series', async () => {
        const metas = await searchCinemeta(query, 'series');
        return metas.map((m) => normalizeCinemetaSearchResult(m, 'tv'));
      })
    );
  }

  if (normalizedType === 'all' || normalizedType === 'anime') {
    jobs.push(
      runSource('jikan', async () => {
        const animeList = await searchJikanByQuery(query, JIKAN_LIMIT);
        return animeList.map(normalizeJikanSearchResult);
      })
    );
  }

  // Every job in `jobs` already catches internally (runSource), so this
  // Promise.all can never reject — kept as allSettled anyway as a second
  // layer of defense against a future source that forgets the contract.
  const settled = await Promise.allSettled(jobs);
  const outcomes = settled.map((s) =>
    s.status === 'fulfilled' ? s.value : { label: 'unknown', status: 'error', results: [] }
  );

  const results = rankAndDedupe(outcomes.flatMap((o) => o.results), query).slice(0, resultLimit);
  const sourceStatus = Object.fromEntries(outcomes.map((o) => [o.label, o.status]));

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.status(200).json({
    query,
    type: normalizedType,
    count: results.length,
    results,
    meta: { sources: sourceStatus },
  });
}
