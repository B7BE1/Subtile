/**
 * قاعدة البيانات التجريبية للأفلام والمسلسلات وملفات الترجمة
 * Mock Database for Movies, TV Shows, and Subtitles
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
      },
      {
        id: "sub-dune-2",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        release: "Dune.Part.Two.2024.2160p.UHD.HDR.WEB-DL.DDP5.1.Atmos",
        quality: "4K WEB-DL",
        format: "SRT",
        uploader: "Kamel_Trans",
        downloads: 8930,
        rating: 4.9,
        hearingImpaired: false,
        fps: "24.000",
        date: "2024-04-10"
      },
      {
        id: "sub-dune-3",
        language: "en",
        langName: "English",
        langFlag: "🇬🇧",
        release: "Dune.Part.Two.2024.ALL.WEBRip.and.BluRay",
        quality: "BluRay / WEB",
        format: "SRT",
        uploader: "OfficialSubtitles",
        downloads: 32400,
        rating: 4.8,
        hearingImpaired: true,
        fps: "23.976",
        date: "2024-04-09"
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
      },
      {
        id: "sub-opp-2",
        language: "en",
        langName: "English",
        langFlag: "🇬🇧",
        release: "Oppenheimer.2023.IMAX.2160p.UHD.HDR.BluRay",
        quality: "4K IMAX",
        format: "SRT",
        uploader: "GoldSubs",
        downloads: 18900,
        rating: 4.9,
        hearingImpaired: true,
        fps: "23.976",
        date: "2023-11-19"
      }
    ]
  },
  {
    id: "breaking-bad",
    title: "Breaking Bad",
    arabicTitle: "بريكينغ باد",
    type: "tv",
    seasonsCount: 5,
    episodesPerSeason: 13,
    year: 2008,
    rating: 9.5,
    genres: ["Crime", "Drama", "Thriller"],
    poster: "https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    overview: "معلم كيمياء في المدرسة الثانوية يُشخص بسرطان الرئة غير القابل للشفاء، فيتحول إلى تصنيع وبيع الميثامفيتامين لتأمين مستقبل عائلته المالي.",
    imdbId: "tt0903747",
    subtitles: [
      {
        id: "sub-bb-s5-all",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        season: 5,
        episode: "All",
        release: "Breaking.Bad.S05.1080p.BluRay.x264-ROVERS",
        quality: "1080p Complete Season",
        format: "ZIP",
        uploader: "Heisenberg_Sub",
        downloads: 48900,
        rating: 5.0,
        date: "2023-01-15"
      },
      {
        id: "sub-bb-s5e14",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        season: 5,
        episode: 14,
        release: "Breaking.Bad.S05E14.Ozymandias.1080p.BluRay",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "MasterArabic",
        downloads: 31200,
        rating: 5.0,
        date: "2023-02-10"
      },
      {
        id: "sub-bb-s1e1",
        language: "en",
        langName: "English",
        langFlag: "🇬🇧",
        season: 1,
        episode: 1,
        release: "Breaking.Bad.S01E01.Pilot.720p.BluRay.x264",
        quality: "720p BluRay",
        format: "SRT",
        uploader: "TVSubtitles",
        downloads: 15400,
        rating: 4.8,
        date: "2022-08-01"
      }
    ]
  },
  {
    id: "the-batman",
    title: "The Batman",
    arabicTitle: "ذا باتمان",
    type: "movie",
    year: 2022,
    rating: 7.8,
    genres: ["Action", "Crime", "Drama"],
    duration: "2h 56m",
    poster: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/b0PlSFdDwbyK0cf5RxwDpaOJQvQ.jpg",
    overview: "عندما يشرع قاتل متسلسل سادي في استهداف الشخصيات السياسية الرئيسية في غوثام، يُجبر باتمان على التحقيق في فساد المدينة الخفي والتساؤل عن تورط عائلته.",
    imdbId: "tt1877830",
    subtitles: [
      {
        id: "sub-bat-1",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        release: "The.Batman.2022.1080p.WEBRip.x264-RARBG",
        quality: "1080p WEBRip",
        format: "SRT",
        uploader: "GothamKnight",
        downloads: 19800,
        rating: 4.8,
        fps: "23.976",
        date: "2022-04-18"
      }
    ]
  },
  {
    id: "interstellar",
    title: "Interstellar",
    arabicTitle: "بين النجوم",
    type: "movie",
    year: 2014,
    rating: 8.7,
    genres: ["Adventure", "Drama", "Sci-Fi"],
    duration: "2h 49m",
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    overview: "فريق من المستكشفين يسافر عبر ثقب دودي في الفضاء في محاولة لضمان بقاء البشرية والعثور على كوكب جديد صالح للحياة.",
    imdbId: "tt0816692",
    subtitles: [
      {
        id: "sub-inter-1",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        release: "Interstellar.2014.1080p.BluRay.x264.DTS-HD.MA.5.1",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "CinemaUniverse",
        downloads: 64200,
        rating: 5.0,
        fps: "23.976",
        date: "2021-05-14"
      }
    ]
  },
  {
    id: "attack-on-titan",
    title: "Attack on Titan",
    arabicTitle: "هجوم العمالقة",
    type: "tv",
    seasonsCount: 4,
    episodesPerSeason: 25,
    year: 2013,
    rating: 9.1,
    genres: ["Animation", "Action", "Fantasy"],
    poster: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/rqbCbjB19amtOtFQbb3K2lgm2zv.jpg",
    overview: "بعد أن تدمر مدينته وتقتل والدته، يقسم الشاب إيرين ييغر على تطهير الأرض من العمالقة العملاقة الذين قادوا البشرية إلى حافة الانقراض.",
    imdbId: "tt2560140",
    subtitles: [
      {
        id: "sub-aot-s4",
        language: "ar",
        langName: "العربية",
        langFlag: "🇸🇦",
        season: 4,
        episode: "All",
        release: "Shingeki.no.Kyojin.The.Final.Season.1080p.BD.Dual-Audio",
        quality: "1080p BDRip",
        format: "ZIP",
        uploader: "AnimeTops_AR",
        downloads: 38400,
        rating: 5.0,
        date: "2023-12-05"
      }
    ]
  }
];

function getRecentSubtitles() {
  const allSubs = [];
  MOVIES_DATABASE.forEach(item => {
    item.subtitles.forEach(sub => {
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
