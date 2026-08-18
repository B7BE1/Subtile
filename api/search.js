/**
 * Universal Search API (Cinemeta for Movies/Series + Jikan for Anime)
 * Reuses the same source modules and normalized schema as api/metadata.js
 * (lib/metadata/*) so search results and detail-page results never
 * disagree in shape. Each source is best-effort: one failing source
 * returns an empty list rather than failing the whole request.
 */

import { searchCinemeta } from '../lib/metadata/sources/cinemeta.js';
import { searchJikanByQuery } from '../lib/metadata/sources/jikan.js';
import { normalizeCinemetaSearchResult, normalizeJikanSearchResult } from '../lib/metadata/normalize.js';

export default async function handler(req, res) {
  const { q, type = 'all' } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  try {
    const searchPromises = [];

    if (type === 'all' || type === 'movie') {
      searchPromises.push(
        searchCinemeta(q, 'movie').then((metas) => metas.map((m) => normalizeCinemetaSearchResult(m, 'movie')))
      );
    }

    if (type === 'all' || type === 'tv' || type === 'series') {
      searchPromises.push(
        searchCinemeta(q, 'series').then((metas) => metas.map((m) => normalizeCinemetaSearchResult(m, 'tv')))
      );
    }

    if (type === 'all' || type === 'anime') {
      searchPromises.push(
        searchJikanByQuery(q, 8).then((animeList) => animeList.map(normalizeJikanSearchResult))
      );
    }

    const settled = await Promise.all(searchPromises);
    const results = settled.flat();

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ query: q, count: results.length, results });
  } catch (error) {
    console.error(JSON.stringify({ source: 'search-handler', error: error.message }));
    return res.status(500).json({ error: 'Search failed' });
  }
}
