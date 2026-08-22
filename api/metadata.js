/**
 * Serverless Metadata API (Cinemeta for Movies/Series + Jikan v4 for Anime,
 * AniList as anime fallback only).
 *
 * 1. Checks local MOVIES_DATABASE first (instant response, Arabic metadata, curated subtitles)
 * 2. Falls back to online sources (Cinemeta / Jikan / AniList) via resolveMetadata()
 */

import { createRequire } from 'module';
import { resolveMetadata, InvalidRequestError } from '../lib/metadata/resolveMetadata.js';
import { ttlForStatus } from '../lib/metadata/cache.js';

const require = createRequire(import.meta.url);
const { MOVIES_DATABASE } = require('../js/data.js');

export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;

  // 1. البحث في القاعدة المحلية أولاً (لإظهار العربي والترجمات المخصصة)
  const localItem = (MOVIES_DATABASE || []).find(item => item.id === id || item.imdbId === id);
  
  if (localItem) {
    // إذا وجدناه محلياً، نرجعه فوراً بدون سؤال السيرفر الخارجي
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({
      ...localItem,
      title_ar: localItem.title_ar || localItem.arabicTitle, // دعم للمفتاحين احتياطاً
      stale: false,
      degraded: false
    });
  }

  // 2. إذا لم يكن محلياً، نكمل البحث في الإنترنت (الكود القديم)
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
