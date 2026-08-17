/**
 * خدمة الربط مع TMDB API لجلب معلومات وبوسترات الأفلام
 * تم تعديلها لاستخدام الـ Serverless Functions للـ Proxy
 */
class TMDBService {
  constructor() {
    this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
    this.backdropBaseUrl = 'https://image.tmdb.org/t/p/original';
    this.cachePrefix = 'subhub_tmdb_';
  }

  // دالة مساعدة للحصول على البيانات من التخزين المؤقت
  _getCached(key) {
    const cached = sessionStorage.getItem(this.cachePrefix + key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // دالة مساعدة لحفظ البيانات في التخزين المؤقت
  _setCache(key, data) {
    try {
      sessionStorage.setItem(this.cachePrefix + key, JSON.stringify(data));
    } catch (e) {
      console.warn('SessionStorage is full or unavailable');
    }
  }

  async search(query, type = 'multi') {
    const cacheKey = `search_${type}_${query}`;
    const cachedData = this._getCached(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      // الاتصال بالـ Serverless API Proxy الخاصة بنا
      const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&type=${type}`);
      if (!response.ok) throw new Error('Search API Error');
      
      const data = await response.json();
      
      const results = (data.results || []).map(r => ({
        id: r.id.toString(),
        title: r.title || r.name,
        type: r.media_type === 'tv' || type === 'tv' ? 'tv' : 'movie',
        year: (r.release_date || r.first_air_date || '').substring(0, 4),
        rating: r.vote_average ? r.vote_average.toFixed(1) : 'N/A',
        poster: r.poster_path ? `${this.imageBaseUrl}${r.poster_path}` : '',
        backdrop: r.backdrop_path ? `${this.backdropBaseUrl}${r.backdrop_path}` : '',
        overview: r.overview || ''
      }));

      this._setCache(cacheKey, results);
      return results;
    } catch (e) {
      console.error('TMDB Search Error:', e);
      // Fallback: search local DB if available
      if (typeof MOVIES_DATABASE !== 'undefined') {
        return MOVIES_DATABASE.filter(item => 
          item.title.toLowerCase().includes(query.toLowerCase()) || 
          (item.arabicTitle && item.arabicTitle.includes(query)) ||
          (item.imdbId && item.imdbId.toLowerCase() === query.toLowerCase())
        );
      }
      return [];
    }
  }

  async getMetadata(id, type = 'movie') {
    const cacheKey = `meta_${type}_${id}`;
    const cachedData = this._getCached(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const response = await fetch(`/api/metadata?id=${id}&type=${type}`);
      if (!response.ok) throw new Error('Metadata API Error');
      
      const data = await response.json();
      
      const metadata = {
        id: data.id.toString(),
        title: data.title || data.name,
        type: type,
        year: (data.release_date || data.first_air_date || '').substring(0, 4),
        rating: data.vote_average ? data.vote_average.toFixed(1) : 'N/A',
        poster: data.poster_path ? `${this.imageBaseUrl}${data.poster_path}` : '',
        backdrop: data.backdrop_path ? `${this.backdropBaseUrl}${data.backdrop_path}` : '',
        overview: data.overview || '',
        genres: (data.genres || []).map(g => g.name),
        runtime: data.runtime || (data.episode_run_time ? data.episode_run_time[0] : null) || 'N/A',
        seasons: data.seasons ? data.seasons.filter(s => s.season_number > 0).map(s => ({
          season_number: s.season_number,
          name: s.name,
          episode_count: s.episode_count
        })) : []
      };

      this._setCache(cacheKey, metadata);
      return metadata;
    } catch (e) {
      console.error('TMDB Metadata Error:', e);
      return null;
    }
  }
}

const tmdb = new TMDBService();

