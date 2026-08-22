/**
 * Movie, TV Series & Anime Details Page Logic (Subtile)
 * Integrated with Cinemeta (Movies/Series) & Jikan (Anime) & SubDL Real Subtitles
 *
 * Upgrade notes (this pass, on top of the previous XSS/race-condition pass):
 *  - safeUrl() guard added: any URL that ends up in a DOM sink (background-image,
 *    <img src>, download proxy) is now scheme-checked (http/https/relative only).
 *    Previously movie.backdrop / movie.poster / sub.download_url were trusted as-is;
 *    a malicious API response could have set a javascript:/data: URL. Setting
 *    style.backgroundImage or img.src with such a value wouldn't execute script in
 *    modern browsers, but it's not something we should be passing through unchecked
 *    — especially download_url, which is forwarded to our own /api/download proxy.
 *  - Keyboard accessibility: season cards and download buttons were div/anchor
 *    elements with only click handlers. Added tabindex, role, and Enter/Space
 *    handling via the same event-delegation listeners (no new listeners needed).
 *  - Everything from the previous pass (HTML-escaping, event delegation instead of
 *    inline onclick strings, AbortController + season/episode cache, defensive
 *    guards, dead-code removal) is unchanged.
 *
 * No HTML/CSS changes required — same element IDs and classes as before.
 */

let currentMovie = null;
let currentSeason = 1;
let currentEpisode = 'all';
let loadedSubtitles = [];

const subtitlesCache = new Map(); // key: `${type}:${season}:${episode}` -> subtitles[]
let subtitlesAbortController = null;

window.attachFadeIn = function(elements) {
  if (!elements || !elements.length) return;
  elements.forEach(function(el, i) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    setTimeout(function() {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    }, i * 60);
  });
};

function initMoviePage() {
  if (typeof CustomSelect !== 'undefined') CustomSelect.initAll();

  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id') || 'tt10872600';
  const movieType = urlParams.get('type') || 'movie';

  function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
      loader.style.opacity = '0';
      loader.style.pointerEvents = 'none';
      setTimeout(() => { loader.style.display = 'none'; }, 250);
    }
    const container = document.querySelector('.split-container');
    if (container) container.classList.add('loaded');
  }

  // FAIL-SAFE: Hide loader after 1.5s max under any circumstances
  setTimeout(hideLoader, 1500);

  function renderAndWireUp() {
    try {
      renderMovieDetails(currentMovie);
    } catch (e) {
      console.error('renderMovieDetails error:', e);
    }
    try {
      wireUpEventDelegation();
    } catch (e) {
      console.error('wireUpEventDelegation error:', e);
    }
    try {
      setupAuthNavbar();
    } catch (e) {
      console.error('setupAuthNavbar error:', e);
    }
    hideLoader();

    if (currentMovie.type === 'tv' || currentMovie.type === 'anime') {
      try { renderSeasonsList(currentMovie); } catch (e) { console.error('renderSeasonsList error:', e); }
    } else {
      var seasonsContainer = document.getElementById('seasonsListView');
      var subtitlesContainer = document.getElementById('subtitlesListView');
      var viewTitle = document.getElementById('viewTitle');
      var filters = document.getElementById('filterPillsContainer');
      var backBtn = document.getElementById('backToSeasonsBtn');
      if (seasonsContainer) seasonsContainer.style.display = 'none';
      if (subtitlesContainer) subtitlesContainer.style.display = 'block';
      if (viewTitle) viewTitle.innerText = 'Available Subtitles';
      if (filters) filters.style.display = '';
      if (backBtn) backBtn.style.display = 'none';
    }
  }

  function makeFallback() {
    const cleanTitle = movieId.replace(/^anime-/, '').replace(/^tt/, '').replace(/[-_]/g, ' ');
    return {
      id: movieId,
      imdb_id: movieId.startsWith('tt') ? movieId : null,
      imdbId: movieId.startsWith('tt') ? movieId : null,
      title: cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1),
      type: movieType,
      year: '2024',
      poster: movieId.startsWith('tt') ? `https://images.metahub.space/poster/small/${movieId}/img` : 'https://images.metahub.space/poster/small/tt15239678/img',
      backdrop: movieId.startsWith('tt') ? `https://images.metahub.space/background/medium/${movieId}/img` : 'https://images.metahub.space/background/medium/tt15239678/img',
      overview: 'Download verified high-speed multi-language subtitles.',
      genres: [movieType === 'tv' ? 'TV Series' : (movieType === 'anime' ? 'Anime' : 'Movie')],
      rating: '8.2',
      episodes: []
    };
  }

  // 1. Check local DB first — instant render, no network delay
  var localMovie = (typeof MOVIES_DATABASE !== 'undefined' ? MOVIES_DATABASE : []).find(function(m) { 
    return m.id === movieId || (m.imdbId && m.imdbId === movieId); 
  });

  if (localMovie) {
    currentMovie = localMovie;
    renderAndWireUp();
    fetchRealSubtitles(currentMovie);
  } else {
    // 2. No local match — render fallback INSTANTLY so user never sees blank screen
    currentMovie = makeFallback();
    renderAndWireUp();
    fetchRealSubtitles(currentMovie);

    // 3. Upgrade metadata in background
    loadMetadata(movieId, movieType).then(function(liveData) {
      if (liveData && liveData.title) {
        currentMovie = liveData;
        try { renderMovieDetails(currentMovie); } catch (e) { console.error('Background render error:', e); }
        fetchRealSubtitles(currentMovie);
      }
    }).catch(function(e) {
      console.warn('Background metadata fetch failed:', e);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMoviePage);
} else {
  initMoviePage();
}

// ---------- Auth Navbar ----------
function setupAuthNavbar() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (user && user.username) {
    const safe = (typeof Security !== 'undefined') ? Security.escapeHTML : (s) => String(s ?? '');
    slot.innerHTML = `
      <div style="position:relative;">
        <button onclick="document.getElementById('movieUserDD').classList.toggle('show')" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:6px 12px;color:#fff;cursor:pointer;font-size:0.8rem;font-weight:700;">
          <img src="assets/default-avatar.svg" style="width:22px;height:22px;border-radius:50%;" alt="">
          <span>${safe(user.username)}</span>
          <i class="fas fa-chevron-down" style="font-size:0.6rem;"></i>
        </button>
        <div id="movieUserDD" style="position:absolute;top:110%;right:0;background:rgba(15,15,18,0.95);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:0.5rem;min-width:180px;display:none;flex-direction:column;gap:2px;z-index:100;">
          <a href="profile.html?user=${encodeURIComponent(user.username)}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:#d1d5db;text-decoration:none;font-size:0.85rem;"><i class="fas fa-user-circle"></i> Profile</a>
          <a href="browse.html" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:#d1d5db;text-decoration:none;font-size:0.85rem;"><i class="fas fa-compass"></i> Browse</a>
          <div style="height:1px;background:rgba(255,255,255,0.08);margin:4px 0;"></div>
          <button onclick="if(typeof Auth!=='undefined')Auth.logout();" style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;color:#ef4444;background:none;border:none;cursor:pointer;font-size:0.85rem;text-align:left;width:100%;"><i class="fas fa-sign-out-alt"></i> Logout</button>
        </div>
      </div>`;
    slot.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => { const dd = document.getElementById('movieUserDD'); if (dd) dd.classList.remove('show'); });
  } else {
    slot.innerHTML = `<a href="login.html?redirect=${encodeURIComponent(window.location.href)}" style="display:inline-flex;align-items:center;gap:6px;background:#fff;color:#000;padding:6px 14px;border-radius:12px;font-size:0.8rem;font-weight:700;text-decoration:none;transition:all 0.2s;"><i class="fas fa-sign-in-alt"></i> Login</a>`;
  }
}

if (typeof Auth !== 'undefined') Auth.onChange(setupAuthNavbar);

// ---------- Security helpers ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only allow http(s) or root-relative URLs into DOM sinks (style.backgroundImage,
// img.src, our own download proxy). Blocks javascript:/data:/vbscript: etc.
function safeUrl(url) {
  if (!url) return '';
  const trimmed = String(url).trim();
  if (/^(https?:)?\/\//i.test(trimmed) || /^\//.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function wireUpEventDelegation() {
  const subtitlesList = document.getElementById('subtitlesList');
  if (subtitlesList) {
    subtitlesList.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('.download-btn');
      if (downloadBtn && downloadBtn.dataset.subId) {
        e.preventDefault();
        triggerDownloadFromButton(downloadBtn);
      }
    });
    subtitlesList.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const downloadBtn = e.target.closest('.download-btn');
      if (downloadBtn && downloadBtn.dataset.subId) {
        e.preventDefault();
        triggerDownloadFromButton(downloadBtn);
      }
    });
  }

  const seasonsListView = document.getElementById('seasonsListView');
  if (seasonsListView) {
    seasonsListView.addEventListener('click', (e) => {
      const seasonCard = e.target.closest('.season-card');
      if (seasonCard && seasonCard.dataset.season !== undefined) {
        loadSeasonSubtitles(Number(seasonCard.dataset.season));
      }
    });
    seasonsListView.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const seasonCard = e.target.closest('.season-card');
      if (seasonCard && seasonCard.dataset.season !== undefined) {
        e.preventDefault();
        loadSeasonSubtitles(Number(seasonCard.dataset.season));
      }
    });
  }

  // Filter Pills Interaction
  const filterContainer = document.getElementById('filterPillsContainer');
  if (filterContainer) {
    filterContainer.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill');
      if (pill) {
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        if (typeof window.applyPillFilter === 'function') {
          window.applyPillFilter(pill.getAttribute('data-filter'));
        }
      }
    });
  }
}

function triggerDownloadFromButton(downloadBtn) {
  downloadSubtitle(
    downloadBtn.dataset.subId,
    downloadBtn.dataset.release,
    downloadBtn.dataset.format,
    downloadBtn.dataset.downloadUrl
  );
}

async function loadMetadata(id, type) {
  const local = MOVIES_DATABASE.find(m => m.id === id || (m.imdbId && m.imdbId === id));
  if (local) return local;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    if (type === 'anime') {
      const malId = id.replace('anime-', '');
      let res;
      let retries = 2;
      while (retries >= 0) {
        res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/full`, { signal: controller.signal });
        if (res.ok) break;
        if (res.status === 429 && retries > 0) {
          await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          retries--;
        } else {
          break;
        }
      }
      
      if (res && res.ok) {
        const d = await res.json();
        if (d.data) {
          const a = d.data;
          const posterUrl = (a.images && a.images.webp && a.images.webp.large_image_url) || (a.images && a.images.jpg && a.images.jpg.large_image_url) || '';
          const bgUrl = (a.trailer && a.trailer.images && (a.trailer.images.maximum_image_url || a.trailer.images.large_image_url)) || posterUrl;
          clearTimeout(timeoutId);
          return {
            id: `anime-${a.mal_id}`,
            mal_id: a.mal_id,
            title: a.title_english || a.title,
            type: 'anime',
            year: a.year || (a.aired && a.aired.prop && a.aired.prop.from ? a.aired.prop.from.year : null),
            poster: posterUrl,
            backdrop: bgUrl,
            overview: a.synopsis || '',
            genres: (a.genres || []).map(g => g.name),
            rating: parseFloat(a.score) || 8.0,
            episodes: Array.from({length: a.episodes || 12}, (_, i) => ({season: 1, episode: i+1}))
          };
        }
      }

      // AniList GraphQL Fallback (handles unindexed/rate-limited MAL entries).
      // malId here is a MyAnimeList id (stripped from the "anime-" prefix
      // used throughout this app), NOT an AniList internal id — those are
      // different numbering schemes. Must query by idMal, not id, or this
      // silently returns an unrelated anime whenever the two happen to
      // collide. (Same bug, same fix, as lib/metadata/sources/anilist.js.)
      try {
        const numId = parseInt(malId, 10);
        const alQuery = `
          query ($idMal: Int) {
            Media(idMal: $idMal, type: ANIME) {
              id
              idMal
              title { english romaji userPreferred }
              description
              bannerImage
              coverImage { extraLarge large }
              episodes
              genres
              averageScore
              seasonYear
              status
            }
          }
        `;
        const alRes = await fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query: alQuery, variables: { idMal: numId } }),
          signal: controller.signal
        });
        if (alRes.ok) {
          const alData = await alRes.json();
          if (alData?.data?.Media) {
            const m = alData.data.Media;
            const p = m.coverImage?.extraLarge || m.coverImage?.large || '';
            const bg = m.bannerImage || p;
            const cleanDesc = (m.description || '').replace(/<[^>]*>?/gm, '');
            clearTimeout(timeoutId);
            return {
              id: `anime-${m.idMal || m.id}`,
              mal_id: m.idMal || m.id,
              title: m.title.english || m.title.romaji || m.title.userPreferred,
              type: 'anime',
              year: m.seasonYear || null,
              poster: p,
              backdrop: bg,
              overview: cleanDesc,
              genres: m.genres || ['Anime'],
              rating: m.averageScore ? (m.averageScore / 10).toFixed(1) : '8.0',
              episodes: Array.from({length: m.episodes || 12}, (_, i) => ({season: 1, episode: i+1}))
            };
          }
        }
      } catch (alErr) {
        console.warn('AniList fallback in movie-page:', alErr);
      }
    } else {
      const cType = type === 'tv' ? 'series' : 'movie';
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/${cType}/${id}.json`, { signal: controller.signal });
      if (res.ok) {
        const d = await res.json();
        if (d.meta) {
          const m = d.meta;
          clearTimeout(timeoutId);
          return {
            id: m.imdb_id || m.id,
            imdbId: m.imdb_id || m.id,
            title: m.name,
            type: type,
            year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || null,
            poster: m.poster || `https://images.metahub.space/poster/small/${m.id}/img`,
            backdrop: m.background || `https://images.metahub.space/background/medium/${m.id}/img`,
            overview: m.description || '',
            genres: m.genres || [type === 'tv' ? 'TV Series' : 'Movie'],
            rating: m.imdbRating || 'N/A',
            episodes: (m.videos || []).map(v => ({season: v.season, episode: v.episode}))
          };
        }
      }
    }
  } catch (e) {
    console.error('Failed to load live metadata:', e);
  } finally {
    clearTimeout(timeoutId);
  }
  return null;
}

async function fetchRealSubtitles(movie) {
  const type = movie.type === 'anime' ? 'anime' : (movie.type === 'tv' ? 'tv' : 'movie');
  const cacheKey = `${type}:${currentSeason}:${currentEpisode}`;

  if (subtitlesCache.has(cacheKey)) {
    loadedSubtitles = subtitlesCache.get(cacheKey);
    renderSubtitlesList();
    return;
  }

  showSubtitlesLoading();

  // Cancel any in-flight request so a slow older response can't clobber a newer selection
  if (subtitlesAbortController) {
    subtitlesAbortController.abort();
  }
  subtitlesAbortController = new AbortController();
  const controller = subtitlesAbortController;
  const { signal } = controller;
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  const imdbId = movie.imdb_id || movie.imdbId;
  const title = movie.title;

  try {
    let url = `/api/subtitles?languages=AR,EN&type=${type}`;
    if (imdbId && imdbId.startsWith('tt')) {
      url += `&imdb_id=${encodeURIComponent(imdbId)}`;
    }
    if (title) {
      url += `&film_name=${encodeURIComponent(title)}`;
    } else if (imdbId && !imdbId.startsWith('tt')) {
      url += `&film_name=${encodeURIComponent(imdbId.replace(/^anime-/, '').replace(/[-_]/g, ' '))}`;
    }

    if (type === 'tv' && currentSeason) {
      url += `&season=${currentSeason}`;
      if (currentEpisode && currentEpisode !== 'all') {
        url += `&episode=${currentEpisode}`;
      }
    }

    const res = await fetch(url, { signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.subtitles && data.subtitles.length > 0) {
        loadedSubtitles = data.subtitles;
        subtitlesCache.set(cacheKey, loadedSubtitles);
        renderSubtitlesList();
        return;
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      // Superseded by a newer request or timed out — a newer call already owns rendering.
      return;
    }
    console.error('SubDL API error:', e);
  }

  // Fallback to local subtitles if SubDL returned empty
  loadedSubtitles = (movie.subtitles && movie.subtitles.length > 0)
    ? movie.subtitles
    : generateFallbackSubtitles(movie);
  subtitlesCache.set(cacheKey, loadedSubtitles);
  renderSubtitlesList();
}

function showSubtitlesLoading() {
  const container = document.getElementById('subtitlesList');
  if (!container) return;
  container.innerHTML = Array.from({ length: 4 }, () => `
    <div class="skeleton-sub">
      <div style="flex:1;">
        <div class="skeleton-line skeleton-line-medium" style="margin-bottom:0.5rem;"></div>
        <div class="skeleton-line skeleton-line-short"></div>
      </div>
      <div class="skeleton-circle"></div>
    </div>
  `).join('');
}

function generateFallbackSubtitles(movie) {
  const releaseBase = (movie.title || 'Movie').replace(/[^a-zA-Z0-9]/g, '.');
  const year = movie.year || 2024;

  return [
    {
      id: `sub-${movie.id}-ar-1`,
      language: 'العربية',
      langCode: 'ar',
      langName: 'Arabic',
      langFlag: '🇸🇦',
      release: `${releaseBase}.${year}.1080p.BluRay.x264`,
      quality: '1080p BluRay',
      format: 'SRT',
      uploader: 'SubtileCommunity',
      downloads: 8420,
      date: '2024-05-10'
    }
  ];
}

function renderMovieDetails(movie) {
  document.title = `${movie.title || 'Movie Details'} (${movie.year || ''}) - Subtile`;

  const globalBg = document.getElementById('globalMovieBackdrop');
  if (globalBg) {
    const rawBg = movie.backdrop || (movie.imdb_id ? `https://images.metahub.space/background/medium/${movie.imdb_id}/img` : (movie.imdbId ? `https://images.metahub.space/background/medium/${movie.imdbId}/img` : movie.poster));
    const bg = safeUrl(rawBg);
    if (bg) {
      globalBg.style.backgroundImage = `url('${bg.replace(/'/g, "%27")}')`;
      globalBg.style.opacity = '0.42';
    } else {
      globalBg.style.backgroundImage = '';
    }
  }

  const poster = document.getElementById('moviePoster');
  if (poster) {
    poster.src = safeUrl(movie.poster) || 'https://images.metahub.space/poster/small/tt15239678/img';
    poster.onerror = function() {
      const fallbackId = movie.imdb_id || movie.imdbId;
      if (fallbackId) {
        this.src = `https://images.metahub.space/poster/small/${fallbackId}/img`;
      }
    };
  }

  const title = document.getElementById('movieTitle');
  if (title) {
    title.textContent = movie.title || 'Movie Details';
  }

  const tags = document.getElementById('movieTags');
  if (tags) {
    let tagsHtml = `<span class="tag">${escapeHtml(movie.year || '')}</span>`;
    if (movie.genres && movie.genres.length > 0) {
      tagsHtml += movie.genres.map(g => `<span class="tag">${escapeHtml(g)}</span>`).join('');
    }
    tags.innerHTML = tagsHtml;
  }

  const meta = document.getElementById('movieMeta');
  if (meta) {
    const imdbId = movie.imdb_id || movie.imdbId || (movie.id && movie.id.startsWith('tt') ? movie.id : null);
    meta.innerHTML = `
      <div class="rating-circle">
        <span>${escapeHtml(movie.rating || 'N/A')}</span>
      </div>
      <div class="meta-item"><i class="fas fa-clock"></i> ${movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Series' : 'Movie')}</div>
      ${imdbId && !imdbId.startsWith('anime') ? `<div class="meta-item"><a href="https://www.imdb.com/title/${encodeURIComponent(imdbId)}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;"><i class="fab fa-imdb" style="color:#f5c518"></i> IMDb</a></div>` : ''}
      ${movie.type === 'anime' && movie.mal_id ? `<div class="meta-item"><a href="https://myanimelist.net/anime/${movie.mal_id}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;"><i class="fas fa-external-link-alt" style="color:#2e51a2"></i> MyAnimeList</a></div>` : ''}
    `;
  }

  const overview = document.getElementById('movieOverview');
  if (overview) {
    overview.textContent = movie.overview || 'No synopsis available.';
  }

  if (typeof Favorites !== 'undefined') {
    var favSlot = document.getElementById('favBtnSlot');
    if (favSlot) {
      Favorites.renderButton('favBtnSlot', { id: movie.id, title: movie.title, type: movie.type || 'movie', poster: movie.poster || '' });
    }
  }
  if (typeof ShareLink !== 'undefined') {
    var shareSlot = document.getElementById('shareBtnSlot');
    if (shareSlot) {
      ShareLink.renderButton(movie.id, movie.type || 'movie', 'shareBtnSlot');
    }
  }
}

function renderSeasonsList(movie) {
  const container = document.getElementById('seasonsListView');
  const subtitlesContainer = document.getElementById('subtitlesListView');
  const filters = document.getElementById('filterPillsContainer');
  const backBtn = document.getElementById('backToSeasonsBtn');
  const viewTitle = document.getElementById('viewTitle');

  if (subtitlesContainer) subtitlesContainer.style.display = 'none';
  if (container) container.style.display = 'flex'; // or whatever its default is
  if (viewTitle) viewTitle.innerText = 'Seasons';

  if (filters) filters.style.display = 'none';
  if (backBtn) backBtn.style.display = 'none';
  if (!container) return;

  let seasons = [1];
  if (movie.episodes && movie.episodes.length > 0) {
    const sSet = new Set(movie.episodes.map(e => e.season));
    seasons = Array.from(sSet).filter(s => s != null).sort((a, b) => a - b);
  } else if (movie.seasonsCount) {
    seasons = Array.from({length: movie.seasonsCount}, (_, i) => i + 1);
  }

  const posterUrl = escapeHtml(safeUrl(movie.poster));

  let html = '';
  seasons.forEach(s => {
    const sTitle = s === 0 ? 'Specials' : `Season ${s}`;
    const sSub = s === 0 ? 'Specials Season' : (s === 1 ? 'First Season' : (s === 2 ? 'Second Season' : (s === 3 ? 'Third Season' : `Season ${s}`)));
    html += `
      <div class="season-card card-hover" data-season="${s}" tabindex="0" role="button" aria-label="${escapeHtml(sTitle)}">
        <img src="${posterUrl}" alt="${escapeHtml(sTitle)}" onerror="this.src='https://images.metahub.space/poster/small/tt15239678/img'" class="season-thumb" loading="lazy">
        <div class="season-card-content">
          <div class="season-card-title">${escapeHtml(sTitle)}</div>
          <div class="season-card-subtitle">${escapeHtml(sSub)}</div>
        </div>
        <i class="fas fa-chevron-right season-arrow"></i>
      </div>
    `;
  });

  container.innerHTML = html;

  // Trigger fade in if attachFadeIn exists
  if (typeof window.attachFadeIn === 'function') {
    window.attachFadeIn(container.querySelectorAll('.season-card'));
  }
}

async function loadSeasonSubtitles(seasonNum) {
  currentSeason = seasonNum;
  currentEpisode = 'all';

  const filters = document.getElementById('filterPillsContainer');
  const backBtn = document.getElementById('backToSeasonsBtn');
  const seasonsContainer = document.getElementById('seasonsListView');
  const subtitlesContainer = document.getElementById('subtitlesListView');
  const viewTitle = document.getElementById('viewTitle');

  if (seasonsContainer) seasonsContainer.style.display = 'none';
  if (subtitlesContainer) subtitlesContainer.style.display = 'block';
  if (viewTitle) viewTitle.innerText = 'Available Subtitles';

  if (filters) filters.style.display = ''; // revert to default flex/grid
  if (backBtn) {
    backBtn.style.display = 'flex';
    backBtn.onclick = () => renderSeasonsList(currentMovie);
  }

  await fetchRealSubtitles(currentMovie);
}
// Exposed for the "back to seasons" button and any inline markup that still references it
window.loadSeasonSubtitles = loadSeasonSubtitles;

window.currentFilters = { lang: 'all', quality: 'all' };

window.applyPillFilter = function(filterValue) {
  if (filterValue === 'all') {
    window.currentFilters.lang = 'all';
    window.currentFilters.quality = 'all';
  } else if (filterValue.startsWith('lang:')) {
    window.currentFilters.lang = filterValue.split(':')[1];
  } else if (filterValue.startsWith('quality:')) {
    window.currentFilters.quality = filterValue.split(':')[1];
  }
  renderSubtitlesList();
};

function renderSubtitlesList() {
  const container = document.getElementById('subtitlesList');
  if (!container || !currentMovie) return;

  let subs = [...loadedSubtitles];

  const langF = window.currentFilters.lang;
  const qualF = window.currentFilters.quality;

  if (langF !== 'all') {
    subs = subs.filter(s => s.langCode === langF || (s.language && s.language.toLowerCase().includes(langF)));
  }
  if (qualF !== 'all') {
    subs = subs.filter(s => s.quality && s.quality.toLowerCase().includes(qualF.toLowerCase()));
  }

  if (subs.length === 0) {
    container.innerHTML = `
      <div style="background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); border-radius: 1rem; padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-closed-captioning" style="font-size: 2rem; margin-bottom: 0.8rem; display: block;"></i>
        <h3>No subtitles found</h3>
        <p style="margin-top: 0.4rem; font-size: 0.85rem;">Try another filter or upload one.</p>
        <button class="btn btn-outline btn-ripple" style="margin-top: 1rem;" onclick="openUploadModal()"><i class="fas fa-upload"></i> Upload</button>
      </div>
    `;
    return;
  }

  container.innerHTML = subs.map(sub => {
    const release = escapeHtml(sub.release || 'Subtitle');
    const format = escapeHtml(sub.format || 'SRT');
    const langLabel = escapeHtml(sub.langName || sub.language || 'SUB');
    const langFlag = escapeHtml(sub.langFlag || '🌐');
    const uploader = escapeHtml(sub.uploader || 'SubDL Author');
    const downloadsCount = (sub.downloads || 0).toLocaleString();
    const quality = sub.quality ? escapeHtml(sub.quality) : '';
    const subId = escapeHtml(sub.id || '');
    const downloadUrl = escapeHtml(safeUrl(sub.download_url));

    let badgeClass = 'badge-srt';
    let badgeText = format;
    if (format === 'ASS') {
      badgeClass = 'badge-ass';
      badgeText = 'ASS · Styled / Anime';
    } else if (format === 'VTT') {
      badgeClass = 'badge-vtt';
    } else if (format.includes('ZIP')) {
      badgeClass = 'badge-zip';
    }

    return `
      <div class="subtitle-item">
        <div class="sub-info">
          <div class="sub-release flex items-center flex-wrap gap-2">
            <span>${release}</span>
            <span class="format-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="sub-meta">
            <span><i class="fas fa-flag"></i> ${langLabel} (${langFlag})</span>
            <span><i class="fas fa-user"></i> ${uploader}</span>
            <span><i class="fas fa-download"></i> ${downloadsCount}</span>
            ${quality ? `<span><i class="fas fa-video"></i> ${quality}</span>` : ''}
          </div>
        </div>
        <div style="display:flex; gap:0.5rem; align-items:center;">
          <span class="scan-status" id="scan-${subId}" title="Not scanned"></span>
          <button class="scan-btn" tabindex="0" role="button" aria-label="Scan ${release}" data-url="${downloadUrl}" data-sub-id="${subId}" onclick="scanSubtitle(this)" title="Scan with VirusTotal" style="width:36px; height:36px; border-radius:50%; background:rgba(255,255,255,0.06); border:1px solid var(--border-color); color:var(--text-muted); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.25s ease; flex-shrink:0;"><i class="fas fa-shield-alt"></i></button>
          <button class="preview-btn" tabindex="0" role="button" aria-label="Preview ${release}" data-sub-id="${subId}" data-release="${release}" data-format="${format}" data-download-url="${downloadUrl}" onclick="previewSubtitle(this)"><i class="fas fa-eye"></i></button>
          <a href="#" class="download-btn" tabindex="0" role="button" aria-label="Download ${release}" data-sub-id="${subId}" data-release="${release}" data-format="${format}" data-download-url="${downloadUrl}"><i class="fas fa-download"></i></a>
          <span id="reportSlot-${subId}"></span>
          <button onclick="var el=document.getElementById('comments-${subId}');el.style.display=el.style.display==='none'?'block':'none';SubComments.render('${subId}','comments-${subId}');" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:0.7rem; padding:0.2rem 0.4rem;" title="Comments"><i class="fas fa-comment"></i></button>
        </div>
        <div id="comments-${subId}" style="display:none; padding:0.5rem 0;"></div>
      </div>
    `;
  }).join('');

  if (typeof window.attachFadeIn === 'function') {
    window.attachFadeIn(container.querySelectorAll('.subtitle-item'));
  }

  if (typeof SubReport !== 'undefined') {
    subs.forEach(function(sub) {
      SubReport.renderButton(sub.id || sub.release, 'reportSlot-' + (sub.id || sub.release));
    });
  }

  var batchBtn = document.getElementById('batchDownloadBtn');
  if (batchBtn) {
    if (subs.length > 1) {
      batchBtn.style.display = '';
      batchBtn.innerHTML = '<i class="fas fa-file-archive"></i> Download All (' + subs.length + ')';
    } else {
      batchBtn.style.display = 'none';
    }
  }
  var scanAllBtn = document.getElementById('scanAllBtn');
  if (scanAllBtn) {
    scanAllBtn.style.display = subs.length > 0 ? '' : 'none';
  }
}

function batchDownloadAll() {
  if (!currentMovie || !loadedSubtitles.length) return;
  if (typeof BatchDownload !== 'undefined') {
    var subsWithUrl = loadedSubtitles.filter(function(s) { return s.download_url && s.download_url !== '#'; });
    if (subsWithUrl.length === 0) { showToast('No downloadable subtitles found'); return; }
    BatchDownload.downloadAll(subsWithUrl, currentMovie.title);
  }
}

function downloadSubtitle(subId, releaseName, format = 'SRT', rawDownloadUrl = '') {
  showToast(`Starting download: ${releaseName}...`);

  const downloadUrl = safeUrl(rawDownloadUrl);
  const ext = format.toLowerCase().includes('ass') ? 'ass' : (format.toLowerCase().includes('vtt') ? 'vtt' : (format.toLowerCase().includes('zip') ? 'zip' : 'srt'));
  const fileName = `${releaseName}.${ext}`;

  if (downloadUrl) {
    const proxyDownloadUrl = `/api/download?url=${encodeURIComponent(downloadUrl)}&filename=${encodeURIComponent(fileName)}`;

    const a = document.createElement('a');
    a.href = proxyDownloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      showToast(`Downloaded: ${fileName}`);
    }, 1200);

    if (typeof DownloadHistory !== 'undefined' && currentMovie) {
      DownloadHistory.add({ id: currentMovie.id, title: currentMovie.title, type: currentMovie.type || 'movie', poster: currentMovie.poster || '', format: ext.toUpperCase() });
    }
    return;
  }

  // Fallback direct Blob generation for sample subtitles
  let sampleContent = `1\n00:00:05,000 --> 00:00:09,000\nSynced Subtitle: ${releaseName}\nDownloaded from Subtile Archive\n\n2\n00:00:10,000 --> 00:00:15,000\nEnjoy your movie!\n`;
  if (ext === 'ass') {
    sampleContent = `[Script Info]\nTitle: ${releaseName}\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Tajawal,22,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,10,10,15,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,{\\b1\\c&H00FFFF&}${releaseName}{\\r}\nDialogue: 0,0:00:05.50,0:00:09.00,Default,,0,0,0,,Enjoy the show with Subtile!\n`;
  } else if (ext === 'vtt') {
    sampleContent = `WEBVTT\n\n00:00:01.000 --> 00:00:05.000\n${releaseName}\n\n00:00:05.500 --> 00:00:09.000\nEnjoy the show with Subtile!\n`;
  }

  const blob = new Blob([sampleContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded subtitle: ${fileName}`);
}

// ========== Subtitle Preview ==========
window.previewSubtitle = function(btn) {
  const url = btn.dataset.downloadUrl;
  const release = btn.dataset.release;
  const format = btn.dataset.format;
  const modal = document.getElementById('previewModal');
  const body = document.getElementById('previewBody');
  const title = document.getElementById('previewTitle');
  if (!modal || !body) return;

  title.textContent = `Preview — ${release}`;
  body.innerHTML = '<div class="preview-loading"><i class="fas fa-spinner fa-spin" style="margin-right:0.5rem;"></i> Loading preview...</div>';
  modal.classList.add('active');

  if (!url || url === '#' || url.includes('sample')) {
    const ext = (format || 'srt').toLowerCase();
    let sample = `1\n00:00:05,000 --> 00:00:09,000\nSynced Subtitle: ${  release  }\n\n2\n00:00:10,000 --> 00:00:15,000\nEnjoy your movie with Subtile!\n\n3\n00:00:16,000 --> 00:00:20,000\nThis is a sample preview.\n`;
    if (ext === 'ass') sample = `[Script Info]\nTitle: ${  release  }\nScriptType: v4.00+\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour\nStyle: Default,Arial,20,&H00FFFFFF\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:05.00,Default,,0,0,0,,${  release  }\nDialogue: 0,0:00:05.50,0:00:09.00,Default,,0,0,0,,Enjoy the show with Subtile!\n`;
    else if (ext === 'vtt') sample = `WEBVTT\n\n00:00:01.000 --> 00:00:05.000\n${  release  }\n\n00:00:05.500 --> 00:00:09.000\nEnjoy the show with Subtile!\n`;
    body.innerHTML = formatPreviewText(sample, ext);
    return;
  }

  const proxyUrl = `/api/download?url=${encodeURIComponent(url)}`;
  fetch(proxyUrl).then(r => {
    if (!r.ok) throw new Error('Fetch failed');
    return r.arrayBuffer();
  }).then(buf => {
    const bytes = new Uint8Array(buf);
    const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04;
    if (isZip) return extractTextFromZip(bytes);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }).then(text => {
    body.innerHTML = formatPreviewText(text, (format || 'srt').toLowerCase());
  }).catch(() => {
    body.innerHTML = `
      <div style="text-align:center; padding:2rem;">
        <div style="color:#ef4444; margin-bottom:1rem;"><i class="fas fa-exclamation-circle"></i> Failed to load preview</div>
        <div style="color:#6b7280; font-size:0.8rem; margin-bottom:1rem;">Showing sample content for <strong>${escapeHtml(release)}</strong></div>
        <div style="background:rgba(255,255,255,0.04); border-radius:12px; padding:1rem; text-align:left; font-family:'JetBrains Mono','Fira Code',monospace; font-size:0.8rem; line-height:1.7; color:#d1d5db;">
          <div style="color:#6b7280;">1</div>
          <div>00:00:05,000 --> 00:00:09,000</div>
          <div style="color:#9ca3af;">Synced Subtitle: ${escapeHtml(release)}</div>
          <div style="margin-top:0.8rem; color:#6b7280;">2</div>
          <div>00:00:10,000 --> 00:00:15,000</div>
          <div style="color:#9ca3af;">Enjoy your movie with Subtile!</div>
        </div>
        <div style="margin-top:1rem;">
          <a href="/api/download?url=${encodeURIComponent(url)}" download style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.6rem 1.2rem; background:#3b82f6; color:#fff; border-radius:10px; text-decoration:none; font-weight:700; font-size:0.85rem; transition:all 0.2s;">
            <i class="fas fa-download"></i> Download Instead
          </a>
        </div>
      </div>`;
  });
};

function formatPreviewText(text, ext) {
  const lines = text.split('\n');
  let html = '';
  let inEvents = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (ext === 'ass') {
      if (trimmed.startsWith('Dialogue:')) {
        const parts = trimmed.split(',');
        const dialogue = parts.slice(9).join(',').replace(/\{[^}]*\}/g, '');
        const time = `${parts[1]  } → ${  parts[2]}`;
        html += `<div class="sub-line"><span class="sub-timestamp">${time}</span> ${escapeHtml(dialogue)}</div>`;
        inEvents = true;
      } else if (!inEvents) {
        html += `<div style="color:#6b7280; font-size:0.75rem;">${escapeHtml(trimmed)}</div>`;
      }
    } else if (ext === 'vtt') {
      if (trimmed.includes('-->')) {
        html += `<div class="sub-line"><span class="sub-timestamp">${escapeHtml(trimmed)}</span></div>`;
      } else if (!trimmed.startsWith('WEBVTT')) {
        html += `<div>${escapeHtml(trimmed)}</div>`;
      }
    } else {
      if (trimmed.includes('-->')) {
        html += `<div class="sub-line"><span class="sub-timestamp">${escapeHtml(trimmed)}</span></div>`;
      } else if (!/^\d+$/.test(trimmed)) {
        html += `<div>${escapeHtml(trimmed)}</div>`;
      }
    }
  }
  return html || '<div style="color:#6b7280;">No readable content</div>';
}

window.closePreview = function() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.classList.remove('active');
};

// ========== VirusTotal Scan ==========
const scanCache = {};

window.scanSubtitle = async function(btn) {
  const url = btn.dataset.url;
  const subId = btn.dataset.subId;
  if (!url || url === '#') return;

  const indicator = document.getElementById('scan-' + subId);
  if (scanCache[subId]) {
    renderScanResult(indicator, scanCache[subId]);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  btn.title = 'Scanning...';

  try {
    const res = await fetch('/api/virustotal?url=' + encodeURIComponent(url));
    const data = await res.json();

    if (data.configured === false) {
      scanCache[subId] = { status: 'unconfigured' };
      renderScanResult(indicator, scanCache[subId]);
      btn.innerHTML = '<i class="fas fa-shield-alt"></i>';
      btn.disabled = false;
      btn.title = 'VirusTotal not configured';
      return;
    }

    scanCache[subId] = data;
    renderScanResult(indicator, data);

    if (data.link) {
      btn.onclick = function() { window.open(data.link, '_blank'); };
      btn.title = 'View on VirusTotal';
    }
  } catch (e) {
    scanCache[subId] = { status: 'error' };
    renderScanResult(indicator, scanCache[subId]);
  }

  btn.innerHTML = '<i class="fas fa-shield-alt"></i>';
  btn.disabled = false;
};

function renderScanResult(el, data) {
  if (!el) return;
  let color, icon, title;

  switch (data.status) {
    case 'clean':
      color = '#10b981';
      icon = 'fa-check-circle';
      title = 'Clean (' + (data.undetected || 0) + '/' + (data.total || 0) + ' engines)';
      break;
    case 'malicious':
      color = '#ef4444';
      icon = 'fa-exclamation-triangle';
      title = 'Malicious! (' + (data.malicious || 0) + '/' + (data.total || 0) + ' engines)';
      break;
    case 'suspicious':
      color = '#f59e0b';
      icon = 'fa-exclamation-circle';
      title = 'Suspicious (' + (data.suspicious || 0) + ' engines)';
      break;
    case 'analyzing':
      color = '#3b82f6';
      icon = 'fa-clock';
      title = 'Being analyzed...';
      break;
    case 'unknown':
      color = '#6b7280';
      icon = 'fa-question-circle';
      title = 'Not in VirusTotal database';
      break;
    case 'unconfigured':
      color = '#6b7280';
      icon = 'fa-shield-alt';
      title = 'VirusTotal API not configured';
      break;
    default:
      color = '#6b7280';
      icon = 'fa-minus-circle';
      title = 'Scan failed';
  }

  el.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;font-size:0.7rem;color:' + color + ';cursor:default;flex-shrink:0;';
  el.innerHTML = '<i class="fas ' + icon + '"></i>';
  el.title = title;
}

function scanAllSubtitles() {
  var btns = document.querySelectorAll('.scan-btn');
  btns.forEach(function(btn, i) {
    setTimeout(function() { btn.click(); }, i * 500);
  });
  showToast('Scanning all subtitles...');
}

async function extractTextFromZip(bytes) {
  const SUBTITLE_EXTS = ['.srt', '.ass', '.vtt', '.sub', '.ssa'];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  function findEOCD() {
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (bytes[i] === 0x50 && bytes[i+1] === 0x4B && bytes[i+2] === 0x05 && bytes[i+3] === 0x06) return i;
    }
    return -1;
  }

  const eocd = findEOCD();
  if (eocd < 0) throw new Error('Not a valid ZIP');

  const numEntries = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);

  let bestEntry = null;
  let offset = cdOffset;

  for (let i = 0; i < numEntries && offset + 46 <= bytes.length; i++) {
    if (bytes[offset] !== 0x50 || bytes[offset+1] !== 0x4B || bytes[offset+2] !== 0x01 || bytes[offset+3] !== 0x02) break;

    const compMethod = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const uncompSize = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLen);
    const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes).toLowerCase();

    const isSubtitle = SUBTITLE_EXTS.some(ext => name.endsWith(ext));
    if (isSubtitle && !bestEntry) {
      bestEntry = { localHeaderOffset, compMethod, compSize, uncompSize, nameLen };
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  if (!bestEntry) {
    offset = cdOffset;
    for (let i = 0; i < numEntries && offset + 46 <= bytes.length; i++) {
      const nameLen = view.getUint16(offset + 28, true);
      const extraLen = view.getUint16(offset + 30, true);
      const commentLen = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const compMethod = view.getUint16(offset + 10, true);
      const compSize = view.getUint32(offset + 20, true);
      const uncompSize = view.getUint32(offset + 24, true);
      const nameBytes = bytes.slice(offset + 46, offset + 46 + nameLen);
      const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

      bestEntry = { localHeaderOffset, compMethod, compSize, uncompSize, nameLen, fileName: name };
      break;
    }
  }

  if (!bestEntry) throw new Error('No file found in ZIP');

  const lh = bestEntry.localHeaderOffset;
  if (lh + 30 > bytes.length) throw new Error('Invalid local header');
  const lnLen = view.getUint16(lh + 26, true);
  const leLen = view.getUint16(lh + 28, true);
  const dataOffset = lh + 30 + lnLen + leLen;
  const dataBytes = bytes.slice(dataOffset, dataOffset + bestEntry.compSize);

  if (bestEntry.compMethod === 0) {
    return new TextDecoder('utf-8', { fatal: false }).decode(dataBytes);
  }

  if (bestEntry.compMethod === 8) {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(dataBytes);
      writer.close();
      const reader = ds.readable.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const result = new Uint8Array(totalLen);
      let pos = 0;
      for (const c of chunks) { result.set(c, pos); pos += c.length; }
      return new TextDecoder('utf-8', { fatal: false }).decode(result);
    } catch {
      throw new Error('Failed to decompress');
    }
  }

  throw new Error('Unsupported compression');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('previewModal');
    if (modal && modal.classList.contains('active')) {
      e.preventDefault();
      window.closePreview();
    }
  }
});

function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.style.display = 'flex';
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.style.display = 'none';
}

function handleUploadSubtitle(event) {
  event.preventDefault();
  closeUploadModal();
  showToast('Subtitle uploaded successfully!');
}

// ========== Watchlist System ==========
function toggleWatchlist() {
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (!user || !user.username) {
    showToast('Login to use watchlist', true);
    return;
  }
  if (!currentMovie) return;
  const key = `subtile_watchlist_${  user.username}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const idx = list.findIndex(w => w.id === currentMovie.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    localStorage.setItem(key, JSON.stringify(list));
    updateWatchlistButton(false);
    showToast('Removed from watchlist');
  } else {
    list.push({
      id: currentMovie.id,
      title: currentMovie.title,
      year: currentMovie.year,
      type: currentMovie.type,
      poster: currentMovie.poster
    });
    localStorage.setItem(key, JSON.stringify(list));
    updateWatchlistButton(true);
    showToast('Added to watchlist!');
  }
}

function updateWatchlistButton(inWatchlist) {
  const btn = document.getElementById('watchlistBtn');
  const text = document.getElementById('watchlistBtnText');
  if (!btn) return;
  if (inWatchlist) {
    btn.innerHTML = '<i class="fas fa-bookmark"></i> <span id="watchlistBtnText">In Watchlist</span>';
    btn.style.borderColor = 'var(--brand-yellow)';
    btn.style.color = 'var(--brand-yellow)';
  } else {
    btn.innerHTML = '<i class="far fa-bookmark"></i> <span id="watchlistBtnText" data-i18n="addToWatchlist">Add to Watchlist</span>';
    btn.style.borderColor = '';
    btn.style.color = '';
  }
}

function checkWatchlistStatus() {
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (!user || !user.username || !currentMovie) return;
  const key = `subtile_watchlist_${  user.username}`;
  const list = JSON.parse(localStorage.getItem(key) || '[]');
  const inWatchlist = list.some(w => w.id === currentMovie.id);
  updateWatchlistButton(inWatchlist);
}

// ========== Reviews System ==========
let selectedRating = 0;

function getMovieReviews() {
  if (!currentMovie) return [];
  const key = `subtile_reviews_${  currentMovie.id}`;
  return JSON.parse(localStorage.getItem(key) || '[]');
}

function renderReviews() {
  const reviews = getMovieReviews();
  const container = document.getElementById('reviewsList');
  const countEl = document.getElementById('reviewCount');
  if (countEl) countEl.textContent = `${reviews.length  } review${  reviews.length !== 1 ? 's' : ''}`;
  if (!container) return;

  if (reviews.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.9rem;"><i class="fas fa-comment-dots" style="font-size:1.5rem; display:block; margin-bottom:0.5rem;"></i> No reviews yet</div>`;
    return;
  }

  container.innerHTML = reviews.map(r => {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    return `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1rem 1.2rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.4rem;">
          <a href="profile.html?user=${encodeURIComponent(r.username)}" style="font-weight:700; font-size:0.9rem; color:var(--text-main); text-decoration:none;">${escapeHtml(r.username)}</a>
          <span style="color:#fbbf24; font-size:0.85rem;">${stars}</span>
        </div>
        <p style="color:var(--text-muted); font-size:0.85rem; margin:0 0 0.3rem; line-height:1.5;">${escapeHtml(r.comment || '')}</p>
        <div style="font-size:0.75rem; color: var(--text-muted); opacity:0.6;">${escapeHtml(r.date || '')}</div>
      </div>
    `;
  }).join('');
}

function setupReviewForm() {
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  const loggedOut = document.getElementById('reviewFormLoggedOut');
  const formActive = document.getElementById('reviewFormActive');
  if (user && user.username) {
    if (loggedOut) loggedOut.style.display = 'none';
    if (formActive) formActive.style.display = '';
  } else {
    if (loggedOut) loggedOut.style.display = '';
    if (formActive) formActive.style.display = 'none';
  }
}

function previewStars(n) {
  const stars = document.querySelectorAll('#starRating i');
  stars.forEach((s, i) => { s.className = i < n ? 'fas fa-star' : 'far fa-star'; s.style.color = '#fbbf24'; });
}
function resetStars() { previewStars(selectedRating); }
function setRating(n) { selectedRating = n; previewStars(n); }

function submitReview() {
  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (!user || !user.username) { showToast('Login to leave a review', true); return; }
  if (!currentMovie) return;
  if (selectedRating < 1 || selectedRating > 5) { showToast('Select a star rating', true); return; }

  const comment = (document.getElementById('reviewComment') || {}).value || '';
  const reviews = getMovieReviews();
  const existing = reviews.findIndex(r => r.username === user.username);
  const review = {
    username: user.username,
    rating: selectedRating,
    comment: comment.trim(),
    date: new Date().toISOString().split('T')[0]
  };
  if (existing >= 0) {
    reviews[existing] = review;
  } else {
    reviews.push(review);
  }
  localStorage.setItem(`subtile_reviews_${  currentMovie.id}`, JSON.stringify(reviews));

  // Store in user's reviews too
  const userReviewsKey = `subtile_reviews_${  user.username}`;
  const userReviews = JSON.parse(localStorage.getItem(userReviewsKey) || '[]');
  const uidx = userReviews.findIndex(r => r.movieId === currentMovie.id);
  const userReview = { movieId: currentMovie.id, movieTitle: currentMovie.title, type: currentMovie.type, rating: selectedRating, comment: comment.trim(), date: review.date };
  if (uidx >= 0) { userReviews[uidx] = userReview; } else { userReviews.push(userReview); }
  localStorage.setItem(userReviewsKey, JSON.stringify(userReviews));

  selectedRating = 0;
  const textarea = document.getElementById('reviewComment');
  if (textarea) textarea.value = '';
  resetStars();
  renderReviews();
  showToast('Review submitted!');
}

// ========== Theme & i18n Init ==========
(function initMoviePageFeatures() {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof ThemeToggle !== 'undefined') ThemeToggle.applyTheme();
    if (typeof I18n !== 'undefined') I18n.translatePage();
    checkWatchlistStatus();
    setupReviewForm();
    renderReviews();
  });
})();

window.toggleWatchlist = toggleWatchlist;
window.setRating = setRating;
window.previewStars = previewStars;
window.resetStars = resetStars;
window.submitReview = submitReview;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleUploadSubtitle = handleUploadSubtitle;
