/**
 * قاعدة البيانات الشاملة للأفلام والمسلسلات والأنمي وملفات الترجمة
 * Subtile Master Rankings & Curated Titles
 */

const MOVIES_DATABASE = [
  // --- MOVIES ---
  {
    id: "tt10872600",
    imdbId: "tt10872600",
    title: "Spider-Man: No Way Home",
    arabicTitle: "سبايدرمان: لا عودة إلى الديار",
    type: "movie",
    year: 2021,
    rating: 8.2,
    genres: ["Action", "Adventure", "Sci-Fi"],
    duration: "2h 28m",
    poster: "https://images.metahub.space/poster/small/tt10872600/img",
    backdrop: "https://images.metahub.space/background/medium/tt10872600/img",
    overview: "With Spider-Man's identity now revealed, Peter asks Doctor Strange for help. When a spell goes wrong, dangerous foes from other worlds start to appear.",
    subtitles: [
      { id: "sub-spm-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Spider-Man.No.Way.Home.2021.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "ArabCinemaTeam", downloads: 48200, date: "2022-03-15" },
      { id: "sub-spm-en-1", language: "English", langCode: "en", langName: "English", langFlag: "🇬🇧", release: "Spider-Man.No.Way.Home.2021.1080p.WEB-DL.DDP5.1", quality: "1080p WEB-DL", format: "SRT", uploader: "Official_Subs", downloads: 54100, date: "2022-03-15" }
    ]
  },
  {
    id: "tt37287335",
    imdbId: "tt37287335",
    title: "Obsession",
    arabicTitle: "الهوس",
    type: "movie",
    year: 2026,
    rating: 7.9,
    genres: ["Horror", "Romance", "Thriller"],
    duration: "1h 48m",
    poster: "https://images.metahub.space/poster/small/tt37287335/img",
    backdrop: "https://images.metahub.space/background/medium/tt37287335/img",
    overview: "Baron 'Bear' Bailey breaks a novelty charm to force his co-worker Nikki Freeman to love him, but the supernatural compulsion warps her mind into violent obsession, trapping him in a nightmare he cannot wish away.",
    subtitles: [
      { id: "sub-obs-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Obsession.2026.1080p.BluRay.x264-Subtile", quality: "1080p BluRay", format: "SRT", uploader: "SubtileOfficial", downloads: 14200, date: "2026-05-12" },
      { id: "sub-obs-en-1", language: "English", langCode: "en", langName: "English", langFlag: "🇬🇧", release: "Obsession.2026.1080p.WEB-DL.AAC-Official", quality: "1080p WEB-DL", format: "ASS", uploader: "Official_Subs", downloads: 18900, date: "2026-05-12" }
    ]
  },
  {
    id: "tt14173636",
    imdbId: "tt14173636",
    title: "The Invite",
    arabicTitle: "الدعوة",
    type: "movie",
    year: 2026,
    rating: 7.9,
    genres: ["Comedy", "Drama", "Romance"],
    duration: "1h 47m",
    poster: "https://images.metahub.space/poster/small/tt14173636/img",
    backdrop: "https://images.metahub.space/background/medium/tt14173636/img",
    overview: "Joe and Angela's marriage is on thin ice. When they invite their enigmatic upstairs neighbors for a dinner party, the night spirals into unexpected places.",
    subtitles: [
      { id: "sub-inv-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "The.Invite.2026.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "SubtileTeam", downloads: 9200, date: "2026-06-20" },
      { id: "sub-inv-en-1", language: "English", langCode: "en", langName: "English", langFlag: "🇬🇧", release: "The.Invite.2026.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "GlobalSubs", downloads: 11400, date: "2026-06-20" }
    ]
  },
  {
    id: "tt36590417",
    imdbId: "tt36590417",
    title: "Don't Say Good Luck",
    arabicTitle: "لا تقل حظاً موفقاً",
    type: "movie",
    year: 2026,
    rating: 8.2,
    genres: ["Comedy", "Drama"],
    duration: "1h 55m",
    poster: "https://images.metahub.space/poster/small/tt36590417/img",
    backdrop: "https://images.metahub.space/background/medium/tt36590417/img",
    overview: "Sophie Birenbaum gets the lead in her high school show, but at the same time, her mom's cancer comes back.",
    subtitles: [
      { id: "sub-dsg-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Dont.Say.Good.Luck.2026.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubMaster", downloads: 8100, date: "2026-07-01" }
    ]
  },
  {
    id: "tt12042730",
    imdbId: "tt12042730",
    title: "Project Hail Mary",
    arabicTitle: "مشروع هايلي ماري",
    type: "movie",
    year: 2026,
    rating: 8.2,
    genres: ["Adventure", "Comedy", "Sci-Fi"],
    duration: "2h 15m",
    poster: "https://images.metahub.space/poster/small/tt12042730/img",
    backdrop: "https://images.metahub.space/background/medium/tt12042730/img",
    overview: "A science teacher wakes up alone on a spaceship. As his memory returns, he uncovers a mission to stop a mysterious substance killing Earth's sun, and realizes that an unexpected friendship may be the key.",
    subtitles: [
      { id: "sub-phm-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Project.Hail.Mary.2026.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "ArabCinemaTeam", downloads: 15300, date: "2026-08-01" }
    ]
  },
  {
    id: "tt0427340",
    imdbId: "tt0427340",
    title: "Masters of the Universe",
    arabicTitle: "سادة الكون",
    type: "movie",
    year: 2026,
    rating: 6.5,
    genres: ["Action", "Adventure", "Fantasy"],
    duration: "2h 05m",
    poster: "https://images.metahub.space/poster/small/tt0427340/img",
    backdrop: "https://images.metahub.space/background/medium/tt0427340/img",
    overview: "Prince Adam discovers that the strange memories shaping his life are real when the lost Sword of Power resurfaces, forcing him to return to Eternia and challenge the tyrant who shattered his family and kingdom.",
    subtitles: [
      { id: "sub-motu-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Masters.of.the.Universe.2026.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ArabSub", downloads: 7200, date: "2026-08-10" }
    ]
  },
  {
    id: "tt15047880",
    imdbId: "tt15047880",
    title: "Disclosure Day",
    arabicTitle: "يوم الكشف",
    type: "movie",
    year: 2026,
    rating: 6.5,
    genres: ["Action", "Drama", "Sci-Fi"],
    duration: "1h 50m",
    poster: "https://images.metahub.space/poster/small/tt15047880/img",
    backdrop: "https://images.metahub.space/background/medium/tt15047880/img",
    overview: "If you found out we weren't alone, if someone showed you, proved it to you, would that frighten you?",
    subtitles: [
      { id: "sub-dd-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Disclosure.Day.2026.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubtileTeam", downloads: 6400, date: "2026-08-15" }
    ]
  },
  {
    id: "tt6791350",
    imdbId: "tt6791350",
    title: "Guardians of the Galaxy Vol. 3",
    arabicTitle: "حراس المجرة: الجزء الثالث",
    type: "movie",
    year: 2023,
    rating: 8.0,
    genres: ["Action", "Adventure", "Comedy"],
    duration: "2h 30m",
    poster: "https://images.metahub.space/poster/small/tt6791350/img",
    backdrop: "https://images.metahub.space/background/medium/tt6791350/img",
    overview: "Still reeling from the loss of Gamora, Peter Quill rallies his team to defend the universe and protect one of their own.",
    subtitles: [
      { id: "sub-gotg3-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Guardians.of.the.Galaxy.Vol.3.2023.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "ArabCinemaTeam", downloads: 38200, date: "2023-08-01" }
    ]
  },
  {
    id: "tt26657236",
    imdbId: "tt26657236",
    title: "Backrooms",
    arabicTitle: "باك روومز",
    type: "movie",
    year: 2026,
    rating: 7.0,
    genres: ["Horror", "Mystery", "Sci-Fi"],
    duration: "1h 42m",
    poster: "https://images.metahub.space/poster/small/tt26657236/img",
    backdrop: "https://images.metahub.space/background/medium/tt26657236/img",
    overview: "After a therapist's patient disappears into a dimension beyond reality, she must venture into the unknown to save him.",
    subtitles: [
      { id: "sub-br-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Backrooms.2026.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "HorrorSubs", downloads: 5800, date: "2026-08-18" }
    ]
  },
  {
    id: "tt11378946",
    imdbId: "tt11378946",
    title: "Michael",
    arabicTitle: "مايكل",
    type: "movie",
    year: 2026,
    rating: 7.5,
    genres: ["Biography", "Drama", "Music"],
    duration: "2h 35m",
    poster: "https://images.metahub.space/poster/small/tt11378946/img",
    backdrop: "https://images.metahub.space/background/medium/tt11378946/img",
    overview: "The early life of musician Michael Jackson, from the discovery of his talent as the lead of the Jackson Five to the artist whose creative ambition fueled a pursuit to become the biggest entertainer in the world.",
    subtitles: [
      { id: "sub-mj-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Michael.2026.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "SubtileOfficial", downloads: 12100, date: "2026-08-20" }
    ]
  },

  // --- TV SERIES ---
  {
    id: "tt9288030",
    imdbId: "tt9288030",
    title: "Reacher",
    arabicTitle: "ريتشر",
    type: "tv",
    year: 2022,
    rating: 8.0,
    genres: ["Action", "Crime", "Drama"],
    poster: "https://images.metahub.space/poster/small/tt9288030/img",
    backdrop: "https://images.metahub.space/background/medium/tt9288030/img",
    overview: "Itinerant former military policeman Jack Reacher solves crimes and metes out his own brand of street justice. Based on the novels by Lee Child.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-reach-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Reacher.S02.1080p.AMZN.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ArabSub", downloads: 22000, date: "2024-01-10" }
    ]
  },
  {
    id: "tt11198330",
    imdbId: "tt11198330",
    title: "House of the Dragon",
    arabicTitle: "آل التنين",
    type: "tv",
    year: 2022,
    rating: 8.3,
    genres: ["Action", "Adventure", "Drama"],
    poster: "https://images.metahub.space/poster/small/tt11198330/img",
    backdrop: "https://images.metahub.space/background/medium/tt11198330/img",
    overview: "An internal succession war within House Targaryen at the height of its power, 172 years before the birth of Daenerys Targaryen.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-hotd-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "House.of.the.Dragon.S02.1080p.MAX.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ArabCinemaTeam", downloads: 35000, date: "2024-06-25" }
    ]
  },
  {
    id: "tt10986410",
    imdbId: "tt10986410",
    title: "Ted Lasso",
    arabicTitle: "تيد لاسو",
    type: "tv",
    year: 2020,
    rating: 8.7,
    genres: ["Comedy", "Drama", "Sport"],
    poster: "https://images.metahub.space/poster/small/tt10986410/img",
    backdrop: "https://images.metahub.space/background/medium/tt10986410/img",
    overview: "American college football coach Ted Lasso is hired to manage AFC Richmond, a struggling English soccer club.",
    seasonsCount: 3,
    subtitles: [
      { id: "sub-ted-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Ted.Lasso.S03.1080p.ATVP.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubtileTeam", downloads: 18000, date: "2023-05-15" }
    ]
  },
  {
    id: "tt2788316",
    imdbId: "tt2788316",
    title: "Shōgun",
    arabicTitle: "شوجون",
    type: "tv",
    year: 2024,
    rating: 8.8,
    genres: ["Adventure", "Drama", "History"],
    poster: "https://images.metahub.space/poster/small/tt2788316/img",
    backdrop: "https://images.metahub.space/background/medium/tt2788316/img",
    overview: "When a mysterious European ship is found marooned in a nearby fishing village, Lord Yoshii Toranaga discovers secrets that could tip the scales of power.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-shogun-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Shogun.2024.S01.1080p.DSNP.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ArabSub_Pro", downloads: 31000, date: "2024-03-20" }
    ]
  },
  {
    id: "tt7660850",
    imdbId: "tt7660850",
    title: "Succession",
    arabicTitle: "الخلافة",
    type: "tv",
    year: 2023,
    rating: 8.9,
    genres: ["Drama"],
    poster: "https://images.metahub.space/poster/small/tt7660850/img",
    backdrop: "https://images.metahub.space/background/medium/tt7660850/img",
    overview: "The Roy family is known for controlling the biggest media and entertainment company in the world. However, their world changes when their aging father steps down.",
    seasonsCount: 4,
    subtitles: [
      { id: "sub-succ-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Succession.S04.1080p.MAX.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ArabSub", downloads: 26000, date: "2023-06-01" }
    ]
  },
  {
    id: "tt9140554",
    imdbId: "tt9140554",
    title: "Loki",
    arabicTitle: "لوكي",
    type: "tv",
    year: 2023,
    rating: 8.2,
    genres: ["Action", "Adventure", "Fantasy"],
    poster: "https://images.metahub.space/poster/small/tt9140554/img",
    backdrop: "https://images.metahub.space/background/medium/tt9140554/img",
    overview: "The mercurial villain Loki resumes his role as the God of Mischief in a new series that takes place after the events of Avengers: Endgame.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-loki-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Loki.S02.1080p.DSNP.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "MarvelSubs", downloads: 29000, date: "2023-11-15" }
    ]
  },
  {
    id: "tt35618070",
    imdbId: "tt35618070",
    title: "Sterling Point",
    arabicTitle: "ستيرلينغ بوينت",
    type: "tv",
    year: 2026,
    rating: 8.6,
    genres: ["Drama", "Mystery"],
    poster: "https://images.metahub.space/poster/small/tt35618070/img",
    backdrop: "https://images.metahub.space/background/medium/tt35618070/img",
    overview: "Annie and her twin brother, raised in NYC by their single father, discover their estranged grandfather bequeathed them a lake island.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-stp-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Sterling.Point.S01.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubtileTeam", downloads: 14000, date: "2026-06-01" }
    ]
  },
  {
    id: "tt14688458",
    imdbId: "tt14688458",
    title: "Silo",
    arabicTitle: "سايلو",
    type: "tv",
    year: 2023,
    rating: 8.1,
    genres: ["Drama", "Mystery", "Sci-Fi"],
    poster: "https://images.metahub.space/poster/small/tt14688458/img",
    backdrop: "https://images.metahub.space/background/medium/tt14688458/img",
    overview: "Men and women live in a giant subterranean silo with strict regulations which they believe protect them from the toxic world on the surface.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-silo-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Silo.S02.1080p.ATVP.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "AppleTVFans", downloads: 24000, date: "2024-11-20" }
    ]
  },
  {
    id: "tt36303968",
    imdbId: "tt36303968",
    title: "Furious",
    arabicTitle: "فيوريوس",
    type: "tv",
    year: 2026,
    rating: 8.6,
    genres: ["Crime", "Drama"],
    poster: "https://images.metahub.space/poster/small/tt36303968/img",
    backdrop: "https://images.metahub.space/background/medium/tt36303968/img",
    overview: "A determined FBI agent delves into a female killer's history while partnering with a seasoned investigator to track her down.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-fur-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Furious.S01.1080p.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubtileTeam", downloads: 11000, date: "2026-07-15" }
    ]
  },
  {
    id: "tt13111078",
    imdbId: "tt13111078",
    title: "Lioness",
    arabicTitle: "لبؤة",
    type: "tv",
    year: 2023,
    rating: 7.8,
    genres: ["Action", "Drama", "Thriller"],
    poster: "https://images.metahub.space/poster/small/tt13111078/img",
    backdrop: "https://images.metahub.space/background/medium/tt13111078/img",
    overview: "CIA operative Joe McNamara and her team attempt to balance their personal and professional lives as the tip of the spear in the agency's war on terror.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-lion-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Lioness.S02.1080p.PARA.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SubMaster", downloads: 19000, date: "2024-11-01" }
    ]
  },

  // --- ANIME ---
  {
    id: "anime-38000",
    imdbId: "tt9335498",
    mal_id: 38000,
    title: "Demon Slayer: Kimetsu no Yaiba",
    arabicTitle: "قاتل الشياطين: كيميتسو نو يايبا",
    type: "anime",
    year: 2024,
    rating: 8.9,
    genres: ["Action", "Fantasy", "Supernatural"],
    poster: "https://images.metahub.space/poster/small/tt9335498/img",
    backdrop: "https://images.metahub.space/background/medium/tt9335498/img",
    overview: "A young man searches for a cure for his sister who turned into a demon while battling powerful demons across Japan.",
    seasonsCount: 4,
    subtitles: [
      { id: "sub-ds-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Kimetsu.no.Yaiba.Hashira.Training.Arc.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "AnimeSub_AR", downloads: 41000, date: "2024-06-15" }
    ]
  },
  {
    id: "anime-16498",
    imdbId: "tt2560140",
    mal_id: 16498,
    title: "Attack on Titan",
    arabicTitle: "هجوم العمالقة",
    type: "anime",
    year: 2023,
    rating: 9.1,
    genres: ["Action", "Mystery", "Drama"],
    poster: "https://images.metahub.space/poster/small/tt2560140/img",
    backdrop: "https://images.metahub.space/background/medium/tt2560140/img",
    overview: "After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans.",
    seasonsCount: 4,
    subtitles: [
      { id: "sub-aot-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Shingeki.no.Kyojin.The.Final.Season.1080p.BluRay", quality: "1080p BluRay", format: "SRT", uploader: "AnimeSub_Pro", downloads: 49000, date: "2023-11-10" }
    ]
  },
  {
    id: "anime-52299",
    imdbId: "tt21209876",
    mal_id: 52299,
    title: "Solo Leveling",
    arabicTitle: "سولو ليفلينج: الارتقاء الفردي",
    type: "anime",
    year: 2024,
    rating: 8.8,
    genres: ["Action", "Fantasy", "Adventure"],
    poster: "https://images.metahub.space/poster/small/tt21209876/img",
    backdrop: "https://images.metahub.space/background/medium/tt21209876/img",
    overview: "In a world where hunters battle deadly monsters, the weakest hunter Sung Jinwoo gains the unique ability to level up infinitely.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-sl-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Solo.Leveling.S01.1080p.CR.WEB-DL.AAC2.0", quality: "1080p WEB-DL", format: "SRT", uploader: "SoloSubs", downloads: 39000, date: "2024-03-30" }
    ]
  },
  {
    id: "anime-40748",
    imdbId: "tt12343534",
    mal_id: 40748,
    title: "Jujutsu Kaisen",
    arabicTitle: "جوجوتسو كايسن",
    type: "anime",
    year: 2023,
    rating: 8.7,
    genres: ["Action", "Supernatural", "Fantasy"],
    poster: "https://images.metahub.space/poster/small/tt12343534/img",
    backdrop: "https://images.metahub.space/background/medium/tt12343534/img",
    overview: "A boy swallows a cursed talisman and becomes possessed by the King of Curses, joining a secret organization of sorcerers.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-jjk-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Jujutsu.Kaisen.S02.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "JujutsuSub", downloads: 36000, date: "2023-12-28" }
    ]
  },
  {
    id: "anime-52991",
    imdbId: "tt22247344",
    mal_id: 52991,
    title: "Frieren: Beyond Journey's End",
    arabicTitle: "فريرين: ما بعد نهاية الرحلة",
    type: "anime",
    year: 2024,
    rating: 9.3,
    genres: ["Adventure", "Fantasy", "Drama"],
    poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-fMjsXJ38qGg0.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt22247344/img",
    overview: "An elf mage reflects on her past adventures and bonds with humans after her hero companions pass away.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-frieren-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Sousou.no.Frieren.S01.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "FrierenSubs", downloads: 28000, date: "2024-03-25" }
    ]
  },
  {
    id: "anime-44511",
    imdbId: "tt13616990",
    mal_id: 44511,
    title: "Chainsaw Man",
    arabicTitle: "رجل المنشار",
    type: "anime",
    year: 2023,
    rating: 8.6,
    genres: ["Action", "Horror", "Supernatural"],
    poster: "https://images.metahub.space/poster/small/tt13616990/img",
    backdrop: "https://images.metahub.space/background/medium/tt13616990/img",
    overview: "Denji is a young man living a life of poverty who merges with his pet devil to become the Chainsaw Man.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-csm-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Chainsaw.Man.S01.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "ChainsawTeam", downloads: 25000, date: "2023-01-10" }
    ]
  },
  {
    id: "anime-21",
    imdbId: "tt0388629",
    mal_id: 21,
    title: "One Piece",
    arabicTitle: "ون بيس",
    type: "anime",
    year: 2024,
    rating: 9.0,
    genres: ["Action", "Adventure", "Fantasy"],
    poster: "https://images.metahub.space/poster/small/tt0388629/img",
    backdrop: "https://images.metahub.space/background/medium/tt0388629/img",
    overview: "Monkey D. Luffy and his pirate crew search for the greatest treasure ever left by the legendary Pirate King.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-op-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "One.Piece.Egghead.Arc.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "StrawHatSubs", downloads: 45000, date: "2024-05-01" }
    ]
  },
  {
    id: "anime-269",
    imdbId: "tt11993480",
    mal_id: 269,
    title: "Bleach: Thousand-Year Blood War",
    arabicTitle: "بليتش: حرب الألف سنة الدموية",
    type: "anime",
    year: 2024,
    rating: 8.9,
    genres: ["Action", "Supernatural", "Fantasy"],
    poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx143270-13D9kUevQ96s.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt11993480/img",
    overview: "The peace is suddenly broken when warning sirens echo through the Soul Society as the Quincy empire launches a war.",
    seasonsCount: 2,
    subtitles: [
      { id: "sub-bleach-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Bleach.TYBW.Part.2.1080p.DSNP.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "SoulReaperSubs", downloads: 31000, date: "2024-04-10" }
    ]
  },
  {
    id: "anime-57334",
    imdbId: "tt30217245",
    mal_id: 57334,
    title: "Dandadan",
    arabicTitle: "داندادان",
    type: "anime",
    year: 2024,
    rating: 8.7,
    genres: ["Action", "Comedy", "Sci-Fi"],
    poster: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx171018-U1vXwR3Hh7c7.jpg",
    backdrop: "https://images.metahub.space/background/medium/tt30217245/img",
    overview: "Two high schoolers who believe in different supernatural phenomena stumble into chaotic encounters with aliens and ghosts.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-dnd-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Dandadan.S01.1080p.CR.WEB-DL", quality: "1080p WEB-DL", format: "SRT", uploader: "DandaSubs", downloads: 22000, date: "2024-10-15" }
    ]
  },
  {
    id: "anime-1535",
    imdbId: "tt0877057",
    mal_id: 1535,
    title: "Death Note",
    arabicTitle: "مذكرة الموت",
    type: "anime",
    year: 2006,
    rating: 9.0,
    genres: ["Mystery", "Thriller", "Supernatural"],
    poster: "https://images.metahub.space/poster/small/tt0877057/img",
    backdrop: "https://images.metahub.space/background/medium/tt0877057/img",
    overview: "An intelligent high school student goes on a secret crusade to eliminate criminals after discovering a notebook capable of killing anyone.",
    seasonsCount: 1,
    subtitles: [
      { id: "sub-dn-ar-1", language: "العربية", langCode: "ar", langName: "Arabic", langFlag: "🇸🇦", release: "Death.Note.Complete.1080p.BluRay.x264", quality: "1080p BluRay", format: "SRT", uploader: "AnimeSub_AR", downloads: 58000, date: "2021-01-10" }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MOVIES_DATABASE };
}
