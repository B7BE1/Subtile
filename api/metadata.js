import { resolveMetadata, InvalidRequestError } from '../lib/metadata/resolveMetadata.js';
import { ttlForStatus } from '../lib/metadata/cache.js';
import { MOVIES_DATABASE } from '../js/data.js';

// إعدادات TMDB (المفتاح يُقرأ من متغيرات البيئة في Vercel)
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACK_BASE = 'https://image.tmdb.org/t/p/original';

/**
 * دالة مساعدة: تجلب الصور من TMDB باستخدام IMDb ID
 * تتدخل فقط لتحديث الـ poster و الـ backdrop
 */
async function fetchTMDBImages(imdbId) {
  if (!imdbId || !TMDB_API_KEY) return null;
  
  try {
    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const res = await fetch(url);
    if (!res.ok) return null;
    
    const data = await res.json();
    let result = null;

    // التحقق إذا كان فيلماً أو مسلسلاً أو أنمي
    if (data.movie_results && data.movie_results.length > 0) {
      result = data.movie_results[0];
    } else if (data.tv_results && data.tv_results.length > 0) {
      result = data.tv_results[0];
    }

    if (result) {
      return {
        poster: result.poster_path ? `${TMDB_IMG_BASE}${result.poster_path}` : null,
        backdrop: result.backdrop_path ? `${TMDB_BACK_BASE}${result.backdrop_path}` : null
      };
    }
  } catch (err) {
    console.error('TMDB Image Fetch Error:', err.message);
  }
  return null;
}

export default async function handler(req, res) {
  const { id, type = 'movie' } = req.query;

  // 1. البحث في القاعدة المحلية أولاً (لإظهار العربي والترجمات المخصصة)
  const localItem = (MOVIES_DATABASE || []).find(item => item.id === id || item.imdbId === id);
  
  if (localItem) {
    // محاولة تحديث الصور من TMDB باستخدام IMDb ID
    const tmdbImages = await fetchTMDBImages(localItem.imdbId || localItem.id);
    
    const payload = {
      ...localItem,
      // استبدال الصور إذا وجدها في TMDB، وإلا استخدام الصور القديمة كـ Fallback
      poster: tmdbImages?.poster || localItem.poster,
      backdrop: tmdbImages?.backdrop || localItem.backdrop
    };

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({
      ...payload,
      title_ar: localItem.title_ar || localItem.arabicTitle, // دعم للمفتاحين
      stale: false,
      degraded: false
    });
  }

  // 2. إذا لم يكن محلياً، نكمل البحث في الإنترنت
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

  if (result.state === 'not_found') return res.status(404).json({ error: 'Not found' });
  if (result.state === 'unavailable') return res.status(503).json({ error: 'All sources unavailable' });

  // 3. تحديث الصور للبيانات القادمة من الإنترنت أيضاً
  const liveImdbId = result.payload.imdbId || id;
  const tmdbImagesLive = await fetchTMDBImages(liveImdbId);
  
  if (tmdbImagesLive) {
    result.payload.poster = tmdbImagesLive.poster || result.payload.poster;
    result.payload.backdrop = tmdbImagesLive.backdrop || result.payload.backdrop;
  }

  const ttl = ttlForStatus(result.payload.content_status);
  res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate`);
  
  return res.status(200).json({
    ...result.payload,
    stale: result.stale,
    degraded: result.degraded,
  });
}
