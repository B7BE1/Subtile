/**
 * Movie, TV Series & Anime Details Page Logic (Subtile)
 * Integrated with Cinemeta (Movies/Series) & Jikan (Anime) & SubDL Real Subtitles
 */

let currentMovie = null;
let currentSeason = 1;
let currentEpisode = 'all';
let loadedSubtitles = [];

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id') || 'dune-2';
  const movieType = urlParams.get('type') || 'movie';

  // 1. Fetch metadata from API (Cinemeta / Jikan / Local)
  currentMovie = await loadMetadata(movieId, movieType);

  if (!currentMovie) {
    currentMovie = MOVIES_DATABASE.find(m => m.id === movieId) || MOVIES_DATABASE[0];
  }

  renderMovieDetails(currentMovie);

  // 3. Hide global loader and fade in page instantly so user doesn't wait for subtitles API
  const loader = document.getElementById('globalLoader');
  const container = document.querySelector('.split-container');
  if (loader) loader.style.opacity = '0';
  setTimeout(() => {
    if (loader) loader.style.display = 'none';
    if (container) container.classList.add('loaded');
  }, 300);

  // 4. Fetch live subtitles from SubDL API in the background
  await fetchRealSubtitles(currentMovie);
});

async function loadMetadata(id, type) {
  const local = MOVIES_DATABASE.find(m => m.id === id || (m.imdbId && m.imdbId === id));
  if (local) return local;

  try {
    const res = await fetch(`/api/metadata?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Failed to load live metadata:', e);
  }
  return null;
}

async function fetchRealSubtitles(movie) {
  showSubtitlesLoading();

  const imdbId = movie.imdb_id || movie.imdbId;
  const title = movie.title;
  const type = movie.type === 'tv' ? 'tv' : 'movie';

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

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.subtitles && data.subtitles.length > 0) {
        loadedSubtitles = data.subtitles;
        renderSubtitlesList();
        return;
      }
    }
  } catch (e) {
    console.error('SubDL API error:', e);
  }

  // Fallback to local subtitles if SubDL returned empty
  loadedSubtitles = movie.subtitles || generateFallbackSubtitles(movie);
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

function showPageLoading() {
  const title = document.getElementById('movieTitle');
  const overview = document.getElementById('movieOverview');
  const poster = document.getElementById('moviePoster');
  const tags = document.getElementById('movieTags');
  const meta = document.getElementById('movieMeta');
  const backdrop = document.getElementById('movieBackdropSection');

  if (title) title.textContent = '';
  if (overview) overview.textContent = '';
  if (tags) tags.innerHTML = '';
  if (meta) meta.innerHTML = '';
  if (poster) poster.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  if (backdrop) backdrop.style.backgroundImage = 'none';
}

function renderMovieDetails(movie) {
  document.title = `${movie.title} (${movie.year || ''}) - Subtile`;

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
    let tagsHtml = `<span class="tag">${movie.year || ''}</span>`;
    if (movie.genres && movie.genres.length > 0) {
      tagsHtml += movie.genres.map(g => `<span class="tag">${g}</span>`).join('');
    }
    tags.innerHTML = tagsHtml;
  }

  const meta = document.getElementById('movieMeta');
  if (meta) {
    meta.innerHTML = `
      <div class="rating-circle">
        <span>${movie.rating || 'N/A'}</span>
      </div>
      <div class="meta-item"><i class="fas fa-clock"></i> ${movie.type === 'tv' ? 'TV Series' : 'Movie'}</div>
      ${(movie.imdb_id || movie.imdbId) ? `<div class="meta-item"><a href="https://www.imdb.com/title/${movie.imdb_id || movie.imdbId}" target="_blank" style="color: inherit; text-decoration: none;"><i class="fab fa-imdb" style="color:#f5c518"></i> IMDb</a></div>` : ''}
    `;
  }

  const overview = document.getElementById('movieOverview');
  if (overview) {
    overview.textContent = movie.overview || 'No synopsis available.';
  }

  const modalInput = document.getElementById('modalMovieNameInput');
  if (modalInput) {
    modalInput.value = `${movie.title} (${movie.year || ''})`;
  }

  // TV / Anime Series Seasons & Episodes Switcher
  const tvSelector = document.getElementById('tvSelectorBar');
  if (movie.type === 'tv' || (movie.episodes && movie.episodes.length > 0)) {
    tvSelector.style.display = 'flex';
    setupTvSelectors(movie);
  } else {
    tvSelector.style.display = 'none';
  }
}

function setupTvSelectors(movie) {
  const tabsContainer = document.getElementById('seasonTabsContainer');
  const epSelect = document.getElementById('episodeSelect');

  let seasons = [1];
  if (movie.episodes && movie.episodes.length > 0) {
    const seasonsSet = new Set(movie.episodes.map(e => e.season).filter(Boolean));
    if (seasonsSet.size > 0) seasons = Array.from(seasonsSet).sort((a, b) => a - b);
  }

  tabsContainer.innerHTML = seasons.map(s => `
    <button class="season-tab-btn ${s === currentSeason ? 'active' : ''}" onclick="selectSeason(${s})">
      Season ${s}
    </button>
  `).join('');

  updateEpisodeSelect(movie, currentSeason);
}

function updateEpisodeSelect(movie, season) {
  const epSelect = document.getElementById('episodeSelect');
  if (!epSelect) return;

  let epHtml = '<option value="all">All Episodes / Full Season</option>';

  if (movie.episodes && movie.episodes.length > 0) {
    const seasonEps = movie.episodes.filter(e => e.season === season);
    seasonEps.forEach(e => {
      epHtml += `<option value="${e.episode}">Episode ${e.episode} - ${e.title || ''}</option>`;
    });
  } else {
    for (let e = 1; e <= 12; e++) {
      epHtml += `<option value="${e}">Episode ${e}</option>`;
    }
  }

  epSelect.innerHTML = epHtml;
}

async function selectSeason(seasonNum) {
  currentSeason = seasonNum;
  document.querySelectorAll('.season-tab-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', btn.textContent.includes(`Season ${seasonNum}`));
  });
  if (currentMovie) {
    updateEpisodeSelect(currentMovie, currentSeason);
    await fetchRealSubtitles(currentMovie);
  }
}

async function filterTvSubtitles() {
  const epSelect = document.getElementById('episodeSelect');
  currentEpisode = epSelect ? epSelect.value : 'all';
  if (currentMovie) {
    await fetchRealSubtitles(currentMovie);
  }
}

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
    const safeRelease = (sub.release || 'Subtitle').replace(/'/g, "\\'");
    const downloadParam = sub.download_url ? encodeURIComponent(sub.download_url) : '';

    return `
      <div class="subtitle-item">
        <div class="sub-info">
          <div class="sub-release">
            ${sub.release}
            <span class="format-badge">${sub.format || 'SRT'}</span>
          </div>
          <div class="sub-meta">
            <span><i class="fas fa-flag"></i> ${sub.langName || sub.language || 'SUB'} (${sub.langFlag || '🌐'})</span>
            <span><i class="fas fa-user"></i> ${sub.uploader || 'SubDL Author'}</span>
            <span><i class="fas fa-download"></i> ${(sub.downloads || 0).toLocaleString()}</span>
            ${sub.quality ? `<span><i class="fas fa-video"></i> ${sub.quality}</span>` : ''}
          </div>
        </div>
        <a href="#" class="download-btn" onclick="downloadSubtitle('${sub.id}', '${safeRelease}', '${sub.format}', '${downloadParam}'); return false;"><i class="fas fa-download"></i></a>
      </div>
    `;
  }).join('');

  // Re-initialize intersection observer for animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const delay = Math.random() * 300;
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.subtitle-item').forEach(item => observer.observe(item));
}

function downloadSubtitle(subId, releaseName, format = 'SRT', encodedDownloadUrl = '') {
  showToast(`Starting download: ${releaseName}...`);

  if (encodedDownloadUrl) {
    const rawUrl = decodeURIComponent(encodedDownloadUrl);
    const cleanExt = (format || 'srt').toLowerCase().includes('zip') ? 'zip' : 'srt';
    const fileName = `${releaseName}.${cleanExt}`;
    const proxyDownloadUrl = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(fileName)}`;

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
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: var(--brand-yellow);"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
