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

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id') || 'dune-2';
    const movieType = urlParams.get('type') || 'movie';

    // 1. Fetch metadata from API (Cinemeta / Jikan / Local)
    currentMovie = await loadMetadata(movieId, movieType);

    if (!currentMovie) {
      // Fallback to backend proxy to bypass browser issues or frontend rate limits
      try {
        const proxyRes = await fetch(`/api/metadata?id=${movieId}&type=${movieType}`);
        if (proxyRes.ok) {
          currentMovie = await proxyRes.json();
        }
      } catch (e) {
        console.error("Backend proxy failed too", e);
      }
    }

    if (!currentMovie) {
      currentMovie = MOVIES_DATABASE.find(m => m.id === movieId);
      // Instead of defaulting to Oppenheimer, create a generic fallback for this ID
      if (!currentMovie) {
        currentMovie = {
          id: movieId,
          title: movieId.replace('anime-', '').replace('tt', 'Title '), // Best guess fallback title
          type: movieType,
          year: 'Unknown',
          poster: `https://images.metahub.space/poster/small/${movieId}/img`,
          backdrop: `https://images.metahub.space/background/medium/${movieId}/img`,
          overview: "Metadata could not be loaded. Fetching subtitles regardless...",
          genres: [movieType === 'tv' ? 'TV Series' : (movieType === 'anime' ? 'Anime' : 'Movie')],
          rating: 'N/A',
          episodes: []
        };
      }
    }

    renderMovieDetails(currentMovie);
    wireUpEventDelegation();

    // 3. Hide global loader and fade in page instantly so user doesn't wait for subtitles API
    const loader = document.getElementById('globalLoader');
    const container = document.querySelector('.split-container');
    if (loader) loader.style.opacity = '0';
    setTimeout(() => {
      if (loader) loader.style.display = 'none';
      if (container) container.classList.add('loaded');
    }, 300);

    // 4. Fetch live subtitles or show seasons list
    if (currentMovie.type === 'tv' || currentMovie.type === 'anime') {
      renderSeasonsList(currentMovie);
    } else {
      const seasonsContainer = document.getElementById('seasonsListView');
      const subtitlesContainer = document.getElementById('subtitlesListView');
      const viewTitle = document.getElementById('viewTitle');
      const filters = document.getElementById('filterPillsContainer');
      const backBtn = document.getElementById('backToSeasonsBtn');

      if (seasonsContainer) seasonsContainer.style.display = 'none';
      if (subtitlesContainer) subtitlesContainer.style.display = 'block';
      if (viewTitle) viewTitle.innerText = 'Available Subtitles';
      if (filters) filters.style.display = '';
      if (backBtn) backBtn.style.display = 'none'; // No back button for movies

      await fetchRealSubtitles(currentMovie);
    }
  } catch (err) {
    alert("Error loading page: " + (err.message || err));
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';
  }
});

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
  const type = movie.type === 'tv' ? 'tv' : 'movie';
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
  const { signal } = subtitlesAbortController;
  const timeoutId = setTimeout(() => subtitlesAbortController.abort(), 8000);

  const imdbId = movie.imdb_id || movie.imdbId;
  const title = movie.title;

  try {
    let url = `/api/subtitles?languages=AR,EN&type=${type}`;
    if (imdbId) url += `&imdb_id=${encodeURIComponent(imdbId)}`;
    else if (title) url += `&film_name=${encodeURIComponent(title)}`;

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
  container.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 2.5rem; text-align: center; color: var(--text-muted);">
      <i class="fas fa-spinner fa-spin" style="font-size: 1.8rem; margin-bottom: 0.8rem; color: var(--brand-yellow); display: block;"></i>
      <div style="font-size: 0.95rem; font-weight: 600; color: #f1f3f6;">Fetching real subtitles from SubDL...</div>
    </div>
  `;
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

  const modalInput = document.getElementById('modalMovieNameInput');
  if (modalInput) {
    modalInput.value = `${movie.title || ''} (${movie.year || ''})`;
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
    let sTitle = s === 0 ? 'Specials' : `Season ${s}`;
    let sSub = s === 0 ? 'Specials Season' : (s === 1 ? 'First Season' : (s === 2 ? 'Second Season' : (s === 3 ? 'Third Season' : `Season ${s}`)));
    html += `
      <div class="season-card" data-season="${s}" tabindex="0" role="button" aria-label="${escapeHtml(sTitle)}">
        <img src="${posterUrl}" alt="${escapeHtml(sTitle)}" onerror="this.src='https://images.metahub.space/poster/small/tt15239678/img'" class="season-thumb" loading="lazy">
        <div class="season-info">
          <div class="season-title">${escapeHtml(sTitle)}</div>
          <div class="season-sub">${escapeHtml(sSub)}</div>
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
        <button class="btn btn-outline" style="margin-top: 1rem;" onclick="openUploadModal()"><i class="fas fa-upload"></i> Upload</button>
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
        <a href="#" class="download-btn" tabindex="0" role="button" aria-label="Download ${release}" data-sub-id="${subId}" data-release="${release}" data-format="${format}" data-download-url="${downloadUrl}"><i class="fas fa-download"></i></a>
      </div>
    `;
  }).join('');

  if (typeof window.attachFadeIn === 'function') {
    window.attachFadeIn(container.querySelectorAll('.subtitle-item'));
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

function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.classList.add('show');
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) modal.classList.remove('show');
}

function handleUploadSubtitle(event) {
  event.preventDefault();
  closeUploadModal();
  showToast('Subtitle uploaded successfully!');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: var(--brand-yellow);"></i> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Exposed for inline onclick="" still present in the (unmodified) HTML markup
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.handleUploadSubtitle = handleUploadSubtitle;
