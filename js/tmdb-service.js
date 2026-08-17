/**
 * خدمة الربط مع TMDB API لجلب معلومات وبوسترات الأفلام
 */
class TMDBService {
  constructor() {
    this.apiKey = ''; // Example: 'YOUR_TMDB_API_KEY'
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.imageBaseUrl = 'https://image.tmdb.org/t/p/w500';
    this.backdropBaseUrl = 'https://image.tmdb.org/t/p/original';
  }

  async search(query) {
    if (!this.apiKey) {
      return MOVIES_DATABASE.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) || 
        (item.arabicTitle && item.arabicTitle.includes(query)) ||
        (item.imdbId && item.imdbId.toLowerCase() === query.toLowerCase())
      );
    }

    try {
      const response = await fetch(`${this.baseUrl}/search/multi?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&language=ar-SA`);
      const data = await response.json();
      return (data.results || []).map(r => ({
        id: r.id.toString(),
        title: r.title || r.name,
        type: r.media_type === 'tv' ? 'tv' : 'movie',
        year: (r.release_date || r.first_air_date || '').substring(0, 4),
        rating: r.vote_average ? r.vote_average.toFixed(1) : 'N/A',
        poster: r.poster_path ? `${this.imageBaseUrl}${r.poster_path}` : '',
        backdrop: r.backdrop_path ? `${this.backdropBaseUrl}${r.backdrop_path}` : '',
        overview: r.overview || ''
      }));
    } catch (e) {
      console.warn('TMDB search fallback to local DB:', e);
      return MOVIES_DATABASE;
    }
  }
}

const tmdb = new TMDBService();
