/**
 * Subtile JavaScript logic (Matching SubDL exact behavior)
 */

document.addEventListener('DOMContentLoaded', () => {
  renderPopularSubtitles();
  renderRecentSubtitlesFeed();
  setupLiveSearch();
  setupAuthNavbar();
});

// عرض الأعمال الشائعة بنمط بطاقات SubDL
function renderPopularSubtitles() {
  const grid = document.getElementById('moviesGrid');
  if (!grid) return;

  grid.innerHTML = MOVIES_DATABASE.map(movie => {
    const mainLang = (movie.subtitles && movie.subtitles[0]) ? movie.subtitles[0].langName : 'Arabic';
    const subCount = movie.subtitles ? movie.subtitles.length * 42 + 5 : 12;

    return `
      <a href="movie.html?id=${movie.id}" class="subdl-card">
        <div class="subdl-poster-wrapper">
          <img src="${movie.poster}" alt="${movie.title}" class="subdl-poster-img" loading="lazy">
        </div>
        <div class="subdl-card-body">
          <div class="subdl-card-title" title="${movie.title}">${movie.title} (${movie.year})</div>
          <div class="subdl-card-pills">
            <span class="subdl-pill subdl-pill-lang">${mainLang}</span>
            <span class="subdl-pill">${subCount} &darr;</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// عرض أحدث ملفات الترجمة
function renderRecentSubtitlesFeed() {
  const feed = document.getElementById('recentSubtitlesFeed');
  if (!feed) return;

  const recent = getRecentSubtitles();

  feed.innerHTML = recent.map(sub => `
    <div class="subdl-card" style="flex-direction: row; align-items: center; justify-content: space-between; padding: 0.75rem 1.2rem; gap: 1rem;">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <span class="subdl-pill subdl-pill-lang" style="font-size: 0.8rem; padding: 0.25rem 0.6rem;">${sub.langFlag} ${sub.langName}</span>
        <div>
          <a href="movie.html?id=${sub.movieId}" style="font-weight: 700; color: #fff; font-size: 0.92rem;">${sub.release}</a>
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.15rem;">
            ${sub.movieTitle} (${sub.movieYear}) &bull; By <span style="color: var(--brand-yellow);">${sub.uploader}</span> &bull; ${sub.downloads.toLocaleString()} downloads
          </div>
        </div>
      </div>
      <div>
        <button class="btn-auth-subdl" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;" onclick="downloadSubtitle('${sub.id}', '${sub.release}', '${sub.format}')">
          <i class="fas fa-download"></i> Download (${sub.format})
        </button>
      </div>
    </div>
  `).join('');
}

// إعداد البحث الفوري
function setupLiveSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      dropdown.classList.remove('show');
      return;
    }

    const matches = MOVIES_DATABASE.filter(item => {
      return item.title.toLowerCase().includes(query) ||
             (item.arabicTitle && item.arabicTitle.includes(query)) ||
             (item.imdbId && item.imdbId.toLowerCase().includes(query));
    });

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 1.2rem; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
          No results found for "${escapeText(query)}"
        </div>
      `;
    } else {
      dropdown.innerHTML = matches.map(movie => `
        <div class="subdl-dropdown-item" onclick="window.location.href='movie.html?id=${movie.id}'">
          <img src="${movie.poster}" class="subdl-dropdown-poster" alt="${movie.title}">
          <div class="subdl-dropdown-info">
            <div class="subdl-dropdown-title">${movie.title} <span style="color: var(--text-muted); font-weight: 400;">(${movie.year})</span></div>
            <div class="subdl-dropdown-meta">
              <span>${movie.type === 'tv' ? 'TV Series' : 'Movie'}</span>
              <span><i class="fas fa-star" style="color: var(--brand-yellow);"></i> ${movie.rating}</span>
              <span>${movie.subtitles ? movie.subtitles.length : 0} subtitles</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    dropdown.classList.add('show');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.subdl-search-container')) {
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

function performSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  if (searchInput && searchInput.value.trim()) {
    const query = searchInput.value.trim().toLowerCase();
    const match = MOVIES_DATABASE.find(item => 
      item.title.toLowerCase().includes(query) || (item.arabicTitle && item.arabicTitle.includes(query))
    );
    if (match) {
      window.location.href = `movie.html?id=${match.id}`;
    } else {
      showToast(`Searching for: ${query}`);
    }
  }
}

function downloadSubtitle(subId, releaseName, format = 'SRT') {
  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
Synced Subtitle: ${releaseName}
Downloaded from Subtile

2
00:00:10,000 --> 00:00:15,000
Enjoy your movie!
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

  showToast(`Downloaded subtitle: ${releaseName}`);
}

function setupAuthNavbar() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;

  const currentUser = localStorage.getItem('subhub_current_user');
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      slot.innerHTML = `
        <button class="btn-auth-subdl" onclick="openAuthModal('profile')">
          <i class="fas fa-user-circle"></i> ${user.username}
        </button>
      `;
      return;
    } catch(e){}
  }

  slot.innerHTML = `
    <button class="btn-auth-subdl" onclick="openAuthModal('login')">
      <i class="fas fa-sign-in-alt"></i> Login / Sign Up
    </button>
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
    if (tabLogin) { tabLogin.className = 'btn-subdl-submit'; tabLogin.style.flex = '1'; }
    if (tabReg) { tabReg.className = 'btn-auth-subdl'; tabReg.style.flex = '1'; tabReg.style.justifyContent = 'center'; }
  } else {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'block';
    if (tabReg) { tabReg.className = 'btn-subdl-submit'; tabReg.style.flex = '1'; }
    if (tabLogin) { tabLogin.className = 'btn-auth-subdl'; tabLogin.style.flex = '1'; tabLogin.style.justifyContent = 'center'; }
  }
}

function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  localStorage.setItem('subhub_current_user', JSON.stringify({ username }));
  closeAuthModal();
  setupAuthNavbar();
  showToast(`Welcome back, ${username}!`);
}

function handleRegisterSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  localStorage.setItem('subhub_current_user', JSON.stringify({ username }));
  closeAuthModal();
  setupAuthNavbar();
  showToast(`Account created for ${username}!`);
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
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: var(--brand-yellow);"></i> <span>${escapeText(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
