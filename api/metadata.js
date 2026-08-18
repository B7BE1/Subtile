/**
 * Serverless Metadata API (Cinemeta for Movies/Series + Jikan v4 for Anime,
 * AniList as anime fallback only). Thin handler: parse request ->
 * resolveMetadata() -> map result to HTTP. All logic lives in lib/metadata/*.
 */

import { resolveMetadata, InvalidRequestError } from '../lib/metadata/resolveMetadata.js';
import { ttlForStatus } from '../lib/metadata/cache.js';

export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;

  let result;
  try {
    result = await resolveMetadata({ id, type });
  } catch (err) {
    if (err instanceof InvalidRequestError) {
      return res.status(400).json({ error: err.message });
    }
    console.error(JSON.stringify({ source: 'handler', error: err.message }));
    return res.status(503).json({ error: 'All sources unavailable' });
  }

  if (result.state === 'not_found') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (result.state === 'unavailable') {
    return res.status(503).json({ error: 'All sources unavailable' });
  }

  const ttl = ttlForStatus(result.payload.content_status);
  res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate`);
  return res.status(200).json({
    ...result.payload,
    stale: result.stale,
    degraded: result.degraded,
  });
}
