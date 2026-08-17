/**
 * Movie & Series Details Page Logic (SubHub)
 */

let currentMovie = null;
let currentSeason = 1;
let currentEpisode = 'all';
const subState = new SubtitleStateManager();

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const movieId = urlParams.get('id') || 'dune-2';

  // 1. جلب بيانات الفيلم/المسلسل من TMDB
  currentMovie = await tmdb.getMetadata(movieId);
  
  if (!currentMovie) {
    // Fallback to local DB if API fails or ID is local
    currentMovie = MOVIES_DATABASE.find(m => m.id === movieId);
    if (!currentMovie) {
      currentMovie = MOVIES_DATABASE[0]; // ultimate fallback
    }
  }

  renderMovieDetails(currentMovie);
  
  // 2. جلب ملفات الترجمة عبر State Manager
  await subState.fetchSubtitles(movieId, currentMovie.type);
  renderSubtitlesList();
});

function renderMovieDetails(movie) {
  document.title = `${movie.title} (${movie.year}) - تحميل الترجمات | SubHub`;

  const backdropSec = document.getElementById('movieBackdropSection');
  if (backdropSec && movie.backdrop) {
    backdropSec.style.backgroundImage = `url('${movie.backdrop}')`;
  }

  const poster = document.getElementById('moviePoster');
  if (poster) poster.src = movie.poster;

  const title = document.getElementById('movieTitle');
  if (title) {
    title.innerHTML = `${movie.title} <span style="font-size: 1.5rem; font-weight: 500; color: var(--text-secondary);">(${movie.year})</span>`;
  }

  const meta = document.getElementById('movieMeta');
  if (meta) {
    meta.innerHTML = `
      <span class="badge ${movie.type === 'tv' ? 'badge-tv' : 'badge-movie'}">${movie.type === 'tv' ? 'مسلسل تلفزيوني' : 'فيلم سينمائي'}</span>
      <span class="badge badge-rating"><i class="fas fa-star"></i> ${movie.rating} / 10</span>
      ${movie.duration ? `<span><i class="far fa-clock"></i> ${movie.duration}</span>` : ''}
      <span>${(movie.genres || []).join(', ')}</span>
      ${movie.imdbId ? `<a href="https://www.imdb.com/title/${movie.imdbId}" target="_blank" style="color: var(--accent-secondary); text-decoration: underline;"><i class="fab fa-imdb"></i> IMDb</a>` : ''}
    `;
  }

  const overview = document.getElementById('movieOverview');
  if (overview) {
    overview.textContent = movie.overview;
  }

  const modalInput = document.getElementById('modalMovieNameInput');
  if (modalInput) {
    modalInput.value = `${movie.title} (${movie.year})`;
  }

  const tvSelector = document.getElementById('tvSelectorBar');
  if (movie.type === 'tv') {
    tvSelector.style.display = 'flex';
    setupTvSelectors(movie);
  } else {
    tvSelector.style.display = 'none';
  }
}

function setupTvSelectors(movie) {
  const tabsContainer = document.getElementById('seasonTabsContainer');
  const epSelect = document.getElementById('episodeSelect');

  const seasons = movie.seasonsCount || 1;
  let tabsHtml = '';
  for (let s = 1; s <= seasons; s++) {
    tabsHtml += `
      <button class="season-tab-btn ${s === currentSeason ? 'active' : ''}" onclick="selectSeason(${s})">
        الموسم ${s}
      </button>
    `;
  }
  tabsContainer.innerHTML = tabsHtml;

  const episodesCount = movie.episodesPerSeason || 10;
  let epHtml = '<option value="all">كل الحلقات / الموسم كامل</option>';
  for (let e = 1; e <= episodesCount; e++) {
    epHtml += `<option value="${e}">الحلقة ${e}</option>`;
  }
  epSelect.innerHTML = epHtml;
}

function selectSeason(seasonNum) {
  currentSeason = seasonNum;
  document.querySelectorAll('.season-tab-btn').forEach((btn, idx) => {
    btn.classList.toggle('active', (idx + 1) === seasonNum);
  });
  subState.setFilter('season', seasonNum);
  renderSubtitlesList();
}

function filterTvSubtitles() {
  const epSelect = document.getElementById('episodeSelect');
  currentEpisode = epSelect ? epSelect.value : 'all';
  subState.setFilter('episode', currentEpisode);
  renderSubtitlesList();
}

function applyFilters() {
  const langFilter = document.getElementById('langFilter').value;
  const qualityFilter = document.getElementById('qualityFilter').value;
  
  subState.setFilter('lang', langFilter);
  subState.setFilter('quality', qualityFilter);
  
  renderSubtitlesList();
}

function renderSubtitlesList() {
  const container = document.getElementById('subtitlesList');
  const countSpan = document.getElementById('subtitlesCount');
  if (!container || !currentMovie) return;

  const subs = subState.getFiltered();

  countSpan.textContent = `${subs.length} ملف ترجمة متوفر`;

  if (subs.length === 0) {
    container.innerHTML = `
      <div style="background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-closed-captioning" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--text-secondary);"></i>
        <h3>لا توجد ترجمات مطابقة للفلاتر المختارة</h3>
        <p style="margin-top: 0.5rem; font-size: 0.9rem;">كن أول من يرفع ترجمة متوافقة لهذا العمل!</p>
        <button class="btn btn-primary" style="margin-top: 1.2rem;" onclick="openUploadModal()"><i class="fas fa-plus"></i> رفع ترجمة الآن</button>
      </div>
    `;
    return;
  }

  container.innerHTML = subs.map(sub => `
    <div class="subtitle-item-card">
      <div class="sub-card-left">
        <div class="lang-flag-box">
          <span>${sub.langFlag}</span>
          <span class="lang-flag-label">${sub.language}</span>
        </div>
        <div class="sub-details">
          <div class="sub-release-title">
            <span>${sub.release}</span>
            <span class="badge badge-quality">${sub.quality}</span>
            ${sub.hearingImpaired ? '<span class="badge" title="ضعاف السمع"><i class="fas fa-deaf"></i> HI</span>' : ''}
          </div>
          <div class="sub-meta-tags">
            <span><i class="fas fa-user-edit"></i> ${sub.uploader}</span>
            <span><i class="fas fa-file-code"></i> ${sub.format}</span>
            ${sub.fps ? `<span><i class="fas fa-film"></i> ${sub.fps} FPS</span>` : ''}
            <span><i class="fas fa-download"></i> ${sub.downloads.toLocaleString()} تحميل</span>
            <span><i class="far fa-calendar-alt"></i> ${sub.date}</span>
          </div>
        </div>
      </div>
      <div class="sub-card-actions">
        <button class="btn btn-primary" onclick="downloadSubtitle('${sub.id}', '${sub.release}', '${sub.format}')">
          <i class="fas fa-download"></i> تحميل (${sub.format})
        </button>
      </div>
    </div>
  `).join('');
}

function downloadSubtitle(subId, releaseName, format = 'SRT') {
  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
مرحباً بكم في فيلم/مسلسل ${currentMovie.title}
النسخة المتوافقة: ${releaseName}

2
00:00:10,000 --> 00:00:15,000
تمت الترجمة وتحميلها عبر SubHub.
نتمنى لكم مشاهدة ممتعة!
`;

  const blob = new Blob([srtSampleContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${releaseName}.${format.toLowerCase()}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`تم بدء تحميل ملف الترجمة (${releaseName}) بنجاح!`);
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
  showToast('تم استلام ملف الترجمة وجاري معالجته وإضافته للقائمة!');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: var(--accent-green);"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
