/**
 * قاعدة البيانات للأفلام والمسلسلات والأنمي وملفات الترجمة
 * Subtile Local Data & Top Rankings
 */

const MOVIES_DATABASE = [
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
    backdrop: "https://image.tmdb.org/t/p/original/rLb2cw0iwO1ekqWAlYXv2D8gPbt.jpg",
    overview: "The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb.",
    imdbId: "tt15398776",
    subtitles: [
      {
        id: "sub-opp-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Oppenheimer.2023.1080p.BluRay.x264-SPARKS",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "ArabCinemaTeam",
        downloads: 25410,
        date: "2023-11-20"
      }
    ]
  },
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
    overview: "Paul Atreides unites with Chani and the Fremen while seeking revenge against the conspirators who destroyed his family.",
    imdbId: "tt15239678",
    subtitles: [
      {
        id: "sub-dune-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Dune.Part.Two.2024.1080p.BluRay.x264.DTS-HD",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "SubMaster_AR",
        downloads: 14250,
        date: "2024-04-12"
      }
    ]
  },
  {
    id: "attack-on-titan",
    title: "Attack on Titan",
    arabicTitle: "هجوم العمالقة",
    type: "anime",
    year: 2013,
    rating: 9.1,
    genres: ["Action", "Fantasy", "Drama"],
    poster: "https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/hP659v1U881g9eUjR09iF9b7cO8.jpg",
    overview: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.",
    imdbId: "tt2560140",
    subtitles: [
      {
        id: "sub-aot-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Shingeki.no.Kyojin.The.Final.Season.Part.3.1080p.CR.WEB-DL",
        quality: "1080p WEB-DL",
        format: "SRT",
        uploader: "AnimeSub_Pro",
        downloads: 12890,
        date: "2024-02-18"
      }
    ]
  },
  {
    id: "breaking-bad",
    title: "Breaking Bad",
    arabicTitle: "اختلال ضال",
    type: "tv",
    year: 2008,
    rating: 9.5,
    genres: ["Crime", "Drama", "Thriller"],
    poster: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    overview: "A chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine.",
    imdbId: "tt0903747",
    subtitles: [
      {
        id: "sub-bb-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Breaking.Bad.Complete.Series.1080p.BluRay.x264",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "HeisenbergSubs",
        downloads: 11420,
        date: "2023-09-14"
      }
    ]
  },
  {
    id: "solo-leveling",
    title: "Solo Leveling",
    arabicTitle: "سولو ليفلينج",
    type: "anime",
    year: 2024,
    rating: 8.5,
    genres: ["Action", "Adventure", "Fantasy"],
    poster: "https://image.tmdb.org/t/p/w500/geCRueV3ElhRTr0xtJuPxJ8HGQJ.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/9faGSFi5jam6pDWGNdcu8R8GvNm.jpg",
    overview: "In a world where hunters must battle deadly monsters, weak hunter Sung Jinwoo discovers a quest only he can see.",
    imdbId: "tt21209876",
    subtitles: [
      {
        id: "sub-sl-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Ore.dake.Level.Up.na.Ken.S01.1080p.CR.WEB-DL",
        quality: "1080p WEB-DL",
        format: "SRT",
        uploader: "ShadowMonarch",
        downloads: 9840,
        date: "2024-03-30"
      }
    ]
  },
  {
    id: "the-batman",
    title: "The Batman",
    arabicTitle: "باتمان",
    type: "movie",
    year: 2022,
    rating: 7.8,
    genres: ["Action", "Crime", "Mystery"],
    poster: "https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/5P8SmMzSNYikXpxil6BYz9G660Z.jpg",
    overview: "When a sadistic serial killer begins murdering key political figures in Gotham, Batman is forced to investigate.",
    imdbId: "tt1877830",
    subtitles: [
      {
        id: "sub-bm-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "The.Batman.2022.2160p.UHD.BluRay.x265",
        quality: "4K UHD BluRay",
        format: "SRT",
        uploader: "GothamKnight",
        downloads: 9150,
        date: "2023-01-15"
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
    poster: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg",
    overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    imdbId: "tt0816692",
    subtitles: [
      {
        id: "sub-int-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Interstellar.2014.1080p.BluRay.x264.DTS-WiKi",
        quality: "1080p BluRay",
        format: "SRT",
        uploader: "NolanFans",
        downloads: 8760,
        date: "2022-08-10"
      }
    ]
  },
  {
    id: "house-of-the-dragon",
    title: "House of the Dragon",
    arabicTitle: "آل التنين",
    type: "tv",
    year: 2022,
    rating: 8.4,
    genres: ["Action", "Adventure", "Drama"],
    poster: "https://image.tmdb.org/t/p/w500/7QMsOTMUswlwxJP0rTTZfmz2tX2.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/etj5CuMuam3U9KuVdyG2KeZo1GF.jpg",
    overview: "The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke.",
    imdbId: "tt11198330",
    subtitles: [
      {
        id: "sub-hotd-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "House.of.the.Dragon.S02.1080p.MAX.WEB-DL.DDP5.1.Atmos",
        quality: "1080p MAX WEB-DL",
        format: "SRT",
        uploader: "WesterosSubs",
        downloads: 8430,
        date: "2024-06-20"
      }
    ]
  },
  {
    id: "jujutsu-kaisen",
    title: "Jujutsu Kaisen",
    arabicTitle: "جوجوتسو كايسن",
    type: "anime",
    year: 2020,
    rating: 8.6,
    genres: ["Animation", "Action", "Fantasy"],
    poster: "https://image.tmdb.org/t/p/w500/hFWP5HkbVEe40hrXgtCeQxoccHE.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/9r8b3fD3NfO2Z0yL6W3T8QjG9F8.jpg",
    overview: "A boy swallows a cursed talisman and becomes cursed himself. He enters a shaman's school to find the demon's other body parts.",
    imdbId: "tt12343534",
    subtitles: [
      {
        id: "sub-jjk-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Jujutsu.Kaisen.S02.Shibuya.Incident.1080p.CR.WEB-DL",
        quality: "1080p WEB-DL",
        format: "SRT",
        uploader: "GojoSubs",
        downloads: 7920,
        date: "2023-12-15"
      }
    ]
  },
  {
    id: "silo",
    title: "Silo",
    arabicTitle: "سايلو",
    type: "tv",
    year: 2023,
    rating: 8.1,
    genres: ["Drama", "Sci-Fi"],
    poster: "https://image.tmdb.org/t/p/w500/1NsqDfqjWzT3l7R1h6C0f0f3t9o.jpg",
    backdrop: "https://image.tmdb.org/t/p/original/9w90w1E5h04tH7kK5C0b9K4x7q2.jpg",
    overview: "Men and women live in a giant subterranean silo with strict regulations which they believe protect them.",
    imdbId: "tt14688458",
    subtitles: [
      {
        id: "sub-silo-1",
        language: "العربية",
        langCode: "ar",
        langName: "Arabic",
        langFlag: "🇸🇦",
        release: "Silo.S01.1080p.ATVP.WEB-DL.DDP5.1.Atmos",
        quality: "1080p WEB-DL",
        format: "SRT",
        uploader: "AppleTVFans",
        downloads: 6540,
        date: "2023-07-02"
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
