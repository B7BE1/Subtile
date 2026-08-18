/**
 * Movie, TV Series & Anime Details Page Logic (Subtile)
 * Integrated with Cinemeta (Movies/Series) & Jikan (Anime)
 */

let currentMovie = null;
let currentSeason = 1;
let currentEpisode = 'all';

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id') || 'dune-2';
  const movieType = urlParams.get('type') || 'movie';

  showPageLoading();

  // 1. Fetch metadata from API (Cinemeta / Jikan / Local)
  currentMovie = await loadMetadata(movieId, movieType);

  if (!currentMovie) {
    currentMovie = MOVIES_DATABASE.find(m => m.id === movieId) || MOVIES_DATABASE[0];
  }

  renderMovieDetails(currentMovie);
  renderSubtitlesList();
});

async function loadMetadata(id, type) {
  // First check local mock DB
  const local = MOVIES_DATABASE.find(m => m.id === id || (m.imdbId && m.imdbId === id));
  if (local) return local;

  try {
    const res = await fetch(`/api/metadata?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        subtitles: generateFallbackSubtitles(data)
      };
    }
  } catch (e) {
    console.error('Failed to load live metadata:', e);
  }
  return null;
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
      uploader: 'SubtileTeam',
      downloads: Math.floor(Math.random() * 8000) + 1200,
      date: '2024-05-10'
    },
    {
      id: `sub-${movie.id}-ar-2`,
      language: 'العربية',
      langCode: 'ar',
      langName: 'Arabic',
      langFlag: '🇸🇦',
      release: `${releaseBase}.${year}.2160p.4K.WEB-DL.HDR`,
      quality: '4K WEB-DL',
      format: 'SRT',
      uploader: 'CinemaMaster',
      downloads: Math.floor(Math.random() * 5000) + 800,
      date: '2024-05-12'
    },
    {
      id: `sub-${movie.id}-en-1`,
      language: 'English',
      langCode: 'en',
      langName: 'English',
      langFlag: '🇬🇧',
      release: `${releaseBase}.${year}.720p.HDTV`,
      quality: '720p HDTV',
      format: 'SRT',
      uploader: 'GlobalSubs',
      downloads: Math.floor(Math.random() * 3000) + 400,
      date: '2024-05-08'
    }
  ];
}

function showPageLoading() {
  const title = document.getElementById('movieTitle');
  if (title) title.textContent = 'Loading metadata...';
}

function renderMovieDetails(movie) {
  document.title = `${movie.title} (${movie.year || ''}) - Subtile`;

  const backdropSec = document.getElementById('movieBackdropSection');
  if (backdropSec && movie.backdrop) {
    backdropSec.style.backgroundImage = `url('${movie.backdrop}')`;
  }

  const poster = document.getElementById('moviePoster');
  if (poster) poster.src = movie.poster || 'assets/default-poster.jpg';

  const title = document.getElementById('movieTitle');
  if (title) {
    title.innerHTML = `${movie.title} <span style="font-size: 1.4rem; font-weight: 500; color: var(--text-secondary);">(${movie.year || 'N/A'})</span>`;
  }

  const meta = document.getElementById('movieMeta');
  if (meta) {
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Series' : 'Movie');
    meta.innerHTML = `
      <span class="badge ${movie.type === 'tv' ? 'badge-tv' : 'badge-movie'}">${typeLabel}</span>
      ${movie.rating ? `<span class="badge badge-rating"><i class="fas fa-star"></i> ${movie.rating} / 10</span>` : ''}
      ${movie.genres && movie.genres.length ? `<span>${movie.genres.join(', ')}</span>` : ''}
      ${movie.imdb_id ? `<a href="https://www.imdb.com/title/${movie.imdb_id}" target="_blank" style="color: #f5c518; margin-left: 0.5rem;"><i class="fab fa-imdb"></i> IMDb</a>` : ''}
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
    <button class="season-tab ${s === currentSeason ? 'active' : ''}" onclick="selectSeason(${s})">
      الموسم ${s}
    </button>
  `).join('');

  updateEpisodeSelect(movie, currentSeason);
}

function updateEpisodeSelect(movie, season) {
  const epSelect = document.getElementById('episodeSelect');
  if (!epSelect) return;

  let epHtml = '<option value="all">كل الحلقات / الموسم كامل</option>';

  if (movie.episodes && movie.episodes.length > 0) {
    const seasonEps = movie.episodes.filter(e => e.season === season);
    seasonEps.forEach(e => {
      epHtml += `<option value="${e.episode}">الحلقة ${e.episode} - ${e.title || ''}</option>`;
    });
  } else {
    for (let e = 1; e <= 12; e++) {
      epHtml += `<option value="${e}">الحلقة ${e}</option>`;
    }
  }

  epSelect.innerHTML = epHtml;
}

function selectSeason(seasonNum) {
  currentSeason = seasonNum;
  document.querySelectorAll('.season-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.textContent.includes(`الموسم ${seasonNum}`));
  });
  if (currentMovie) updateEpisodeSelect(currentMovie, currentSeason);
  renderSubtitlesList();
}

function filterTvSubtitles() {
  const epSelect = document.getElementById('episodeSelect');
  currentEpisode = epSelect ? epSelect.value : 'all';
  renderSubtitlesList();
}

function applyFilters() {
  renderSubtitlesList();
}

function renderSubtitlesList() {
  const container = document.getElementById('subtitlesList');
  const countSpan = document.getElementById('subtitlesCount');
  if (!container || !currentMovie) return;

  const langFilter = document.getElementById('langFilter') ? document.getElementById('langFilter').value : 'all';
  const qualityFilter = document.getElementById('qualityFilter') ? document.getElementById('qualityFilter').value : 'all';

  let subs = currentMovie.subtitles || [];

  if (langFilter !== 'all') {
    subs = subs.filter(s => s.langCode === langFilter || (s.language && s.language.toLowerCase().includes(langFilter)) || (s.langName && s.langName.toLowerCase().includes(langFilter)));
  }

  if (qualityFilter !== 'all') {
    subs = subs.filter(s => s.quality && s.quality.toLowerCase().includes(qualityFilter.toLowerCase()));
  }

  if (countSpan) {
    countSpan.textContent = `${subs.length} ملفات متاحة`;
  }

  if (subs.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-closed-captioning" style="font-size: 2.5rem; margin-bottom: 0.8rem; display: block; color: var(--accent);"></i>
        <h3 style="color: var(--text-primary);">لا توجد ترجمات مطابقة للفلاتر المختارة</h3>
        <p style="margin-top: 0.4rem; font-size: 0.9rem;">كن أول من يرفع ملف ترجمة متوافق لهذا العمل!</p>
        <button class="btn btn-primary" style="margin-top: 1.2rem;" onclick="openUploadModal()"><i class="fas fa-upload"></i> رفع ترجمة الآن</button>
      </div>
    `;
    return;
  }

  container.innerHTML = subs.map(sub => {
    const safeRelease = (sub.release || 'Subtitle').replace(/'/g, "\\'");
    const downloadParam = sub.download_url ? encodeURIComponent(sub.download_url) : '';
    const langBadge = sub.langFlag ? `${sub.langFlag} ${sub.language || sub.langName || 'العربية'}` : (sub.language || 'العربية');

    return `
      <div class="subtitle-card">
        <div class="sub-info">
          <div class="sub-release">${sub.release}</div>
          <div class="sub-meta">
            <span class="badge badge-lang">${langBadge}</span>
            <span class="badge badge-quality">${sub.quality || 'HD'}</span>
            <span><i class="fas fa-user"></i> ${sub.uploader || 'Subtile Team'}</span>
            <span><i class="fas fa-file-code"></i> ${sub.format || 'SRT'}</span>
            <span><i class="fas fa-download"></i> ${(sub.downloads || 0).toLocaleString()} تحميل</span>
            <span><i class="far fa-clock"></i> ${sub.date || 'مؤخراً'}</span>
          </div>
        </div>
        <button class="download-btn" onclick="downloadSubtitle('${sub.id}', '${safeRelease}', '${sub.format || 'SRT'}', '${downloadParam}')" title="تحميل الترجمة">
          <i class="fas fa-download"></i>
        </button>
      </div>
    `;
  }).join('');
}

function downloadSubtitle(subId, releaseName, format = 'SRT') {
  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
Synced Subtitle: ${releaseName}
Downloaded from Subtile (Cinemeta / Jikan Connected)

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
