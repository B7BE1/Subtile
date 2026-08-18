/**
 * قاعدة البيانات التجريبية للأفلام والمسلسلات وملفات الترجمة
 * Mock Database for Movies, TV Shows, and Subtitles (Fallback)
 */

const MOVIES_DATABASE = [
  {
    id: "dune-2",
    title: "Dune: Part Two",
    arabicTitle: "كثيب: الجزء الثاني",
    type: "movie",
    year: 2024,
    rating: 8.6,
    genres: ["Sci-Fi", "Adventure", "Action"],
    duration: "2h 46m",
    poster: "https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s520b4q.jpg",
    overview: "بول أتريدس يتحد مع تشاني والفريمن في مسار انتقامي ضد المتآمرين الذين دمروا عائلته. وفي مواجهة خيار بين حب حياته ومصير الكون بأسره، يسعى لمنع مستقبل فظيع يستطيع هو وحده توقعه.",
    imdbId: "tt15239678",
    subtitles: [
      {
        id: "sub-dune-1",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        release: "Dune.Part.Two.2024.1080p.BluRay.x264.DTS-HD.MA.7.1",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "SubMaster_AR",
        downloads: 14250,
        rating: 5.0,
        hearingImpaired: false,
        fps: "23.976",
        date: "2024-04-12"
      }
    ]
  },
  {
    id: "oppenheimer",
    title: "Oppenheimer",
    arabicTitle: "أوبنهايمر",
    type: "movie",
    year: 2023,
    rating: 8.9,
    genres: ["Biography", "Drama", "History"],
    duration: "3h 00m",
    poster: "https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/fm6KqXpk3M2HVveHwCrBSSBaO0V.jpg",
    overview: "قصة الفيزيائي الأمريكي روبرت أوبنهايمر ودوره في تطوير القنبلة الذرية خلال مشروع مانهاتن في الحرب العالمية الثانية.",
    imdbId: "tt15398776",
    subtitles: [
      {
        id: "sub-opp-1",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        release: "Oppenheimer.2023.1080p.BluRay.x264-SPARKS",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "ArabCinemaTeam",
        downloads: 25410,
        rating: 5.0,
        hearingImpaired: false,
        fps: "23.976",
        date: "2023-11-20"
      }
    ]
  }
];

function getRecentSubtitles() {
  const allSubs = [];
  MOVIES_DATABASE.forEach(item => {
    (item.subtitles || []).forEach(sub => {
      allSubs.push({
        ...sub,
        movieTitle: item.title,
        movieArabicTitle: item.arabicTitle,
        movieId: item.id,
        moviePoster: item.poster,
        movieYear: item.year,
        movieType: item.type
      });
    });
  });
  return allSubs.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * محول مصادر الترجمة (Adapter Pattern)
 * يوحد شكل البيانات القادمة من مختلف الـ APIs لتتوافق مع الواجهة
 */
class SubtitleAdapter {
  static adapt(apiData) {
    if (!apiData || !apiData.subtitles) return [];
    
    return apiData.subtitles.map((sub, index) => {
      const langLower = (sub.language || 'ar').toLowerCase();
      const isArabic = langLower.includes('ar') || langLower.includes('arabic');
      const isEnglish = langLower.includes('en') || langLower.includes('english');
      
      const releaseName = sub.release_name || sub.name || `Release ${index + 1}`;
      
      // Determine file format
      let format = 'SRT';
      if ((sub.download_url && sub.download_url.endsWith('.zip')) || (sub.name && sub.name.endsWith('.zip')) || sub.episode === 'All') {
        format = 'ZIP';
      } else if ((sub.name && sub.name.endsWith('.ass')) || (sub.release_name && sub.release_name.endsWith('.ass'))) {
        format = 'ASS';
      }

      return {
        id: sub.id || `sub-${index}`,
        language: isArabic ? 'ar' : isEnglish ? 'en' : langLower,
        langName: isArabic ? 'العربية' : isEnglish ? 'English' : sub.language,
        langFlag: isArabic ? '🇸🇦' : isEnglish ? '🇬🇧' : '🌐',
        release: releaseName,
        quality: sub.quality || 'BluRay / WEB',
        season: sub.season || null,
        episode: sub.episode || null,
        format: format,
        uploader: sub.author || sub.source_api || 'SubHub Community',
        downloads: sub.downloads || Math.floor(Math.random() * 3000) + 500,
        rating: 5.0,
        hearingImpaired: Boolean(sub.hearing_impaired || sub.hi),
        fps: sub.fps ? String(sub.fps) : '23.976',
        date: sub.date || new Date().toISOString().split('T')[0],
        download_url: sub.download_url || null,
        source_api: sub.source_api || 'Provider'
      };
    });
  }
}

/**
 * State Manager لترجمات صفحة الفيلم/المسلسل
 */
class SubtitleStateManager {
  constructor() {
    this.rawSubtitles = [];
    this.filteredSubtitles = [];
    this.filters = {
      lang: 'all',
      quality: 'all',
      season: 'all',
      episode: 'all'
    };
    this.currentTmdbId = null;
    this.currentType = 'movie';
  }

  async fetchSubtitles(tmdb_id, type = 'movie', season = 'all', episode = 'all') {
    this.currentTmdbId = tmdb_id;
    this.currentType = type;

    try {
      const params = new URLSearchParams({
        tmdb_id: tmdb_id,
        type: type
      });
      if (season && season !== 'all') params.append('season', season);
      if (episode && episode !== 'all') params.append('episode', episode);

      const response = await fetch(`/api/subtitles?${params.toString()}`);
      if (!response.ok) throw new Error('API Error');
      const data = await response.json();
      
      this.rawSubtitles = SubtitleAdapter.adapt(data);
      this.applyFilters();
      return this.filteredSubtitles;
    } catch (e) {
      console.error('Failed to fetch subtitles from API:', e);
      // Fallback to local db if ID exists
      const localMovie = MOVIES_DATABASE.find(m => m.id === tmdb_id || m.imdbId === tmdb_id);
      if (localMovie && localMovie.subtitles) {
        this.rawSubtitles = SubtitleAdapter.adapt({ subtitles: localMovie.subtitles });
      } else {
        this.rawSubtitles = [];
      }
      this.applyFilters();
      return this.filteredSubtitles;
    }
  }

  setFilter(key, value) {
    this.filters[key] = value;
    this.applyFilters();
  }

  applyFilters() {
    this.filteredSubtitles = this.rawSubtitles.filter(sub => {
      let match = true;
      if (this.filters.lang !== 'all' && sub.language !== this.filters.lang) {
        match = false;
      }
      if (this.filters.quality !== 'all') {
        const q = this.filters.quality.toLowerCase();
        const sq = (sub.quality || sub.release).toLowerCase();
        if (q === 'web' && !sq.includes('web')) match = false;
        else if (q === 'bluray' && !sq.includes('bluray') && !sq.includes('bdrip')) match = false;
        else if (q === '4k' && !sq.includes('2160p') && !sq.includes('4k')) match = false;
        else if (q === '1080p' && !sq.includes('1080p')) match = false;
      }
      if (this.filters.season !== 'all' && sub.season && sub.season.toString() !== this.filters.season.toString()) {
        match = false;
      }
      if (this.filters.episode !== 'all' && sub.episode && sub.episode.toString() !== this.filters.episode.toString()) {
        if (sub.episode !== 'All') { // Accept full season packs
          match = false;
        }
      }
      return match;
    });
  }

  getFiltered() {
    return this.filteredSubtitles;
  }
}
