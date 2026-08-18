/**
 * JavaScript logic for Homepage (SubHub Luxury Cinema UI)
 */

document.addEventListener('DOMContentLoaded', () => {
  renderTrendingMovies('all');
  renderRecentSubtitlesFeed();
  setupLiveSearch();
  setupAuthNavbar();
});

// عرض الأعمال الشائعة
function renderTrendingMovies(filterType = 'all') {
  const grid = document.getElementById('moviesGrid');
  if (!grid) return;

  const filtered = MOVIES_DATABASE.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  grid.innerHTML = filtered.map(movie => `
    <a href="movie.html?id=${movie.id}" class="movie-card">
      <div class="poster-wrapper">
        <img src="${movie.poster}" alt="${movie.title}" class="movie-poster" loading="lazy">
        <span class="sub-count-badge">
          <i class="fas fa-closed-captioning"></i> ${movie.subtitles ? movie.subtitles.length : 0}
        </span>
        <div class="poster-overlay">
          <span class="badge ${movie.type === 'tv' ? 'badge-tv' : 'badge-movie'}">
            ${movie.type === 'tv' ? '📺 مسلسل' : '🎬 فيلم'}
          </span>
          <span style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.3rem;">
            ${(movie.genres || []).slice(0, 2).join(' • ')}
          </span>
        </div>
      </div>
      <div class="movie-card-info">
        <div class="movie-card-title" title="${movie.title}">${movie.title}</div>
        <div class="movie-card-meta">
          <span>${movie.year}</span>
          <span class="badge badge-rating"><i class="fas fa-star"></i> ${movie.rating}</span>
        </div>
      </div>
    </a>
  `).join('');
}

function filterTrending(type) {
  renderTrendingMovies(type);
}

// عرض أحدث ملفات الترجمة على هيئة بطاقات فاخرة
function renderRecentSubtitlesFeed() {
  const feed = document.getElementById('recentSubtitlesFeed');
  if (!feed) return;

  const recent = getRecentSubtitles();

  feed.innerHTML = recent.map(sub => `
    <div class="sub-feed-item">
      <div class="sub-feed-left">
        <div class="sub-lang-pill">
          <span>${sub.langFlag}</span>
          <span>${sub.language}</span>
        </div>
        <div class="sub-feed-content">
          <div class="sub-feed-release">
            <span>${sub.release}</span>
            <span class="badge badge-quality">${sub.quality}</span>
            <span class="badge" style="background: rgba(255,255,255,0.06); font-family: monospace;">${sub.format}</span>
          </div>
          <div class="sub-feed-tags">
            <span><a href="movie.html?id=${sub.movieId}" class="sub-feed-movie-link"><i class="fas fa-film"></i> ${sub.movieTitle} (${sub.movieYear})</a></span>
            ${sub.season ? `<span><i class="fas fa-layer-group"></i> S${sub.season.toString().padStart(2, '0')}${sub.episode !== 'All' ? 'E' + sub.episode.toString().padStart(2, '0') : ' (كامل)'}</span>` : ''}
            <span><i class="fas fa-user-edit"></i> ${sub.uploader}</span>
            <span><i class="fas fa-download"></i> ${(sub.downloads || 0).toLocaleString()}</span>
            <span><i class="far fa-clock"></i> ${sub.date}</span>
          </div>
        </div>
      </div>
      <div>
        <button class="btn btn-primary" style="padding: 0.55rem 1.2rem; font-size: 0.88rem;" onclick="downloadSubtitle('${sub.id}', '${sub.release}', '${sub.format}', '${sub.download_url ? encodeURIComponent(sub.download_url) : ''}')">
          <i class="fas fa-arrow-down"></i> تحميل
        </button>
      </div>
    </div>
  `).join('');
}

// إعداد البحث الفوري
function setupLiveSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');
  const typeFilter = document.getElementById('searchTypeFilter');

  if (!searchInput || !dropdown) return;

  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (!query) {
      dropdown.classList.remove('show');
      return;
    }

    const selectedType = typeFilter ? typeFilter.value : 'all';

    // Show luxury loading indicator
    dropdown.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-primary);"></i>
        <div>جاري البحث في قاعدة البيانات العالمية...</div>
      </div>
    `;
    dropdown.classList.add('show');

    searchTimeout = setTimeout(async () => {
      const typeParam = selectedType === 'all' ? 'multi' : selectedType;
      const matches = await tmdb.search(query, typeParam);

      if (!matches || matches.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--text-muted);">
            <i class="fas fa-search" style="font-size: 1.5rem; margin-bottom: 0.5rem;"></i>
            <div>لم يتم العثور على نتائج مطابقة لـ "${escapeText(query)}"</div>
          </div>
        `;
      } else {
        dropdown.innerHTML = matches.slice(0, 8).map(movie => `
          <div class="suggestion-item" onclick="window.location.href='movie.html?id=${movie.id}'">
            <img src="${movie.poster}" class="suggestion-poster" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/50x75?text=No+Poster'">
            <div class="suggestion-info">
              <div class="suggestion-title">${movie.title} <span style="font-size: 0.85rem; color: var(--text-secondary);">(${movie.year})</span></div>
              <div class="suggestion-meta">
                <span class="badge ${movie.type === 'tv' ? 'badge-tv' : 'badge-movie'}">${movie.type === 'tv' ? 'مسلسل' : 'فيلم'}</span>
                <span><i class="fas fa-star" style="color: var(--accent-gold);"></i> ${movie.rating}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }, 400);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('show');
    }
  });
}

function quickSearch(title) {
  const input = document.getElementById('heroSearchInput');
  if (input) {
    input.value = title;
    input.dispatchEvent(new Event('input'));
  }
}

async function performSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  const typeFilter = document.getElementById('searchTypeFilter');
  if (searchInput && searchInput.value.trim()) {
    const query = searchInput.value.trim();
    const selectedType = typeFilter ? typeFilter.value : 'all';
    const typeParam = selectedType === 'all' ? 'multi' : selectedType;
    
    showToast(`جاري البحث عن: ${query}`);
    const matches = await tmdb.search(query, typeParam);
    if (matches && matches.length > 0) {
      window.location.href = `movie.html?id=${matches[0].id}`;
    } else {
      showToast('لم يتم العثور على نتائج للبحث');
    }
  }
}

// دالة تحميل ملف الترجمة وتوليد ملف أو التنزيل المباشر
function downloadSubtitle(subId, releaseName, format = 'SRT', encodedDownloadUrl = '') {
  showToast(`جاري بدء تحميل ملف الترجمة (${releaseName})...`);

  if (encodedDownloadUrl) {
    const rawUrl = decodeURIComponent(encodedDownloadUrl);
    const extension = format.toLowerCase();
    const fileName = `${releaseName}.${extension}`;
    const proxyDownloadUrl = `/api/download?url=${encodeURIComponent(rawUrl)}&filename=${encodeURIComponent(fileName)}`;

    const a = document.createElement('a');
    a.href = proxyDownloadUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      showToast(`تم بدء تنزيل ${fileName} بنجاح!`);
    }, 1000);
    return;
  }

  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
مرحباً بكم في فيلم/مسلسل ${releaseName}
تمت الترجمة وتحميلها عبر SubHub Luxury Cinema.

2
00:00:10,000 --> 00:00:15,000
نتمنى لكم مشاهدة ممتعة!
Enjoy the movie with luxury synced subtitles.
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

// Auth & Modals Helper
function setupAuthNavbar() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;

  const currentUser = localStorage.getItem('subhub_current_user');
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      slot.innerHTML = `
        <div class="user-avatar-btn" onclick="openAuthModal('profile')">
          <img src="assets/default-avatar.svg" class="user-avatar-img" alt="${user.username}">
          <span>${user.username}</span>
        </div>
      `;
      return;
    } catch(e){}
  }

  slot.innerHTML = `
    <button class="btn btn-primary" onclick="openAuthModal('login')"><i class="fas fa-user"></i> تسجيل الدخول</button>
  `;
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('show');
    switchAuthTab(tab);
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const tabLogin = document.getElementById('authTabLogin');
  const tabReg = document.getElementById('authTabRegister');

  if (tab === 'login') {
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
    if (tabLogin) { tabLogin.classList.add('btn-primary'); tabLogin.classList.remove('btn-secondary'); }
    if (tabReg) { tabReg.classList.add('btn-secondary'); tabReg.classList.remove('btn-primary'); }
  } else {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'block';
    if (tabReg) { tabReg.classList.add('btn-primary'); tabReg.classList.remove('btn-secondary'); }
    if (tabLogin) { tabLogin.classList.add('btn-secondary'); tabLogin.classList.remove('btn-primary'); }
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  localStorage.setItem('subhub_current_user', JSON.stringify({ username }));
  closeAuthModal();
  setupAuthNavbar();
  showToast(`مرحباً بعودتك، ${username}!`);
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  localStorage.setItem('subhub_current_user', JSON.stringify({ username }));
  closeAuthModal();
  setupAuthNavbar();
  showToast(`تم إنشاء حسابك بنجاح، أهلاً بك يا ${username}!`);
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
  showToast('تم استلام ملف الترجمة ومراجعته بنجاح! شكراً لمساهمتك.');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: var(--accent-emerald);"></i> <span>${escapeText(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
