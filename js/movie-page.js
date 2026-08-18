/**
 * Movie, TV Series & Anime Details Page Logic (Subtile)
 * Integrated with Cinemeta (Movies/Series) & Jikan (Anime) & SubDL Real Subtitles
 *
 * Upgrade notes (vs. previous version):
 *  - All API-sourced strings (titles, genres, subtitle release/uploader/lang names)
 *    are now HTML-escaped before being inserted via innerHTML. Previously these were
 *    interpolated raw, so a malicious SubDL release name or genre string could inject
 *    markup/script into the page (stored/reflected XSS via a third-party API response).
 *  - Subtitle download and season-select handlers moved from inline onclick="" string
 *    concatenation to event delegation with data-* attributes. The old approach only
 *    escaped single quotes, so release names containing " or < could break out of the
 *    attribute or inject a new handler.
 *  - fetchRealSubtitles now uses an AbortController with a timeout (metadata fetch had
 *    one, subtitles fetch didn't) and cancels any in-flight subtitles request when the
 *    user switches season/episode quickly, preventing a slow older response from
 *    overwriting a newer selection (race condition).
 *  - Added a small in-memory cache keyed by type/season/episode so re-opening a season
 *    you've already viewed doesn't re-hit the network.
 *  - Removed dead/broken code paths: `selectSeason` and `filterTvSubtitles` referenced
 *    `updateEpisodeSelect`, a function that was never defined, and neither was wired to
 *    any element in the current markup. `loadSeasonSubtitles` is the actual live path.
 *  - Defensive guards for missing movie.title / empty genres / empty subtitles arrays.
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
      currentMovie = MOVIES_DATABASE.find(m => m.id === movieId) || MOVIES_DATABASE[0];
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

// ---------- Security helper ----------
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wireUpEventDelegation() {
  const subtitlesList = document.getElementById('subtitlesList');
  if (subtitlesList) {
    subtitlesList.addEventListener('click', (e) => {
      const downloadBtn = e.target.closest('.download-btn');
      if (downloadBtn && downloadBtn.dataset.subId) {
        e.preventDefault();
        downloadSubtitle(
          downloadBtn.dataset.subId,
          downloadBtn.dataset.release,
          downloadBtn.dataset.format,
          downloadBtn.dataset.downloadUrl
        );
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

async function loadMetadata(id, type) {
  const local = MOVIES_DATABASE.find(m => m.id === id || (m.imdbId && m.imdbId === id));
  if (local) return local;

  try {
    if (type === 'anime') {
      const kitsuId = id.replace('anime-', '');
      const res = await fetch(`https://kitsu.io/api/edge/anime/${kitsuId}`);
      if (res.ok) {
        const d = await res.json();
        if (d.data) {
          const a = d.data;
          const attrs = a.attributes || {};
          const posterUrl = (attrs.posterImage && (attrs.posterImage.large || attrs.posterImage.original)) || '';
          const bgUrl = (attrs.coverImage && attrs.coverImage.large) || posterUrl;
          return {
            id: `anime-${a.id}`,
            title: attrs.titles ? (attrs.titles.en || attrs.titles.en_us || attrs.canonicalTitle) : attrs.canonicalTitle,
            type: 'anime',
            year: attrs.startDate ? attrs.startDate.split('-')[0] : null,
            poster: posterUrl,
            backdrop: bgUrl,
            overview: attrs.synopsis || '',
            genres: ['Anime'],
            rating: attrs.averageRating ? (attrs.averageRating / 10).toFixed(1) : 'N/A',
            episodes: Array.from({length: attrs.episodeCount || 12}, (_, i) => ({season: 1, episode: i+1}))
          };
        }
      }
    } else {
      const cType = type === 'tv' ? 'series' : 'movie';
      const res = await fetch(`https://v3-cinemeta.strem.io/meta/${cType}/${id}.json`);
      if (res.ok) {
        const d = await res.json();
        if (d.meta) {
          const m = d.meta;
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

  const backdropSec = document.getElementById('movieBackdropSection');
  if (backdropSec) {
    const bg = movie.backdrop || (movie.imdb_id ? `https://images.metahub.space/background/medium/${movie.imdb_id}/img` : (movie.imdbId ? `https://images.metahub.space/background/medium/${movie.imdbId}/img` : movie.poster));
    if (bg) {
      backdropSec.style.backgroundImage = `url('${bg}')`;
    }
  }

  const poster = document.getElementById('moviePoster');
  if (poster) {
    poster.src = movie.poster || 'https://images.metahub.space/poster/small/tt15239678/img';
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
    const imdbId = movie.imdb_id || movie.imdbId;
    meta.innerHTML = `
      <div class="rating-circle">
        <span>${escapeHtml(movie.rating || 'N/A')}</span>
      </div>
      <div class="meta-item"><i class="fas fa-clock"></i> ${movie.type === 'tv' ? 'TV Series' : 'Movie'}</div>
      ${imdbId ? `<div class="meta-item"><a href="https://www.imdb.com/title/${encodeURIComponent(imdbId)}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;"><i class="fab fa-imdb" style="color:#f5c518"></i> IMDb</a></div>` : ''}
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

  const posterUrl = escapeHtml(movie.poster || '');

  let html = '';
  seasons.forEach(s => {
    let sTitle = s === 0 ? 'Specials' : `Season ${s}`;
    let sSub = s === 0 ? 'Specials Season' : (s === 1 ? 'First Season' : (s === 2 ? 'Second Season' : (s === 3 ? 'Third Season' : `Season ${s}`)));
    html += `
      <div class="season-card" data-season="${s}">
        <img src="${posterUrl}" alt="${escapeHtml(sTitle)}" onerror="this.src='https://images.metahub.space/poster/small/tt15239678/img'" class="season-thumb">
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
    const downloadUrl = escapeHtml(sub.download_url || '');

    return `
      <div class="subtitle-item">
        <div class="sub-info">
          <div class="sub-release">
            ${release}
            <span class="format-badge">${format}</span>
          </div>
          <div class="sub-meta">
            <span><i class="fas fa-flag"></i> ${langLabel} (${langFlag})</span>
            <span><i class="fas fa-user"></i> ${uploader}</span>
            <span><i class="fas fa-download"></i> ${downloadsCount}</span>
            ${quality ? `<span><i class="fas fa-video"></i> ${quality}</span>` : ''}
          </div>
        </div>
        <a href="#" class="download-btn" data-sub-id="${subId}" data-release="${release}" data-format="${format}" data-download-url="${downloadUrl}"><i class="fas fa-download"></i></a>
      </div>
    `;
  }).join('');

  if (typeof window.attachFadeIn === 'function') {
    window.attachFadeIn(container.querySelectorAll('.subtitle-item'));
  }
}

function downloadSubtitle(subId, releaseName, format = 'SRT', rawDownloadUrl = '') {
  showToast(`Starting download: ${releaseName}...`);

  if (rawDownloadUrl) {
    const cleanExt = (format || 'srt').toLowerCase().includes('zip') ? 'zip' : 'srt';
    const fileName = `${releaseName}.${cleanExt}`;
    const proxyDownloadUrl = `/api/download?url=${encodeURIComponent(rawDownloadUrl)}&filename=${encodeURIComponent(fileName)}`;

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
  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
Synced Subtitle: ${releaseName}
Downloaded from Subtile (SubDL Official Sync)

2
00:00:10,000 --> 00:00:15,000
Enjoy your movie!
`;

  const blob = new Blob([srtSampleContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${releaseName}.${(format || 'srt').toLowerCase()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`Downloaded subtitle: ${releaseName}`);
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
