/**
 * Subtile App JavaScript - Search Bar & Most Downloaded Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  renderMostDownloaded();
  setupLiveSearch();
  setupAuthNavbar();
});

// Render Most Downloaded Grid
function renderMostDownloaded() {
  const grid = document.getElementById('mostDownloadedGrid');
  if (!grid) return;

  // Sort by downloads or predefined ranks
  const sorted = [...MOVIES_DATABASE].sort((a, b) => {
    const aDl = a.subtitles ? a.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) : 0;
    const bDl = b.subtitles ? b.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) : 0;
    return bDl - aDl;
  });

  grid.innerHTML = sorted.map((movie, index) => {
    const mainLang = (movie.subtitles && movie.subtitles[0]) ? movie.subtitles[0].langName : 'Arabic';
    const totalDl = movie.subtitles 
      ? movie.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) 
      : 14250;

    return `
      <a href="movie.html?id=${movie.id}" class="movie-card most-downloaded">
        <div class="movie-card-poster-wrap">
          <img src="${movie.poster}" alt="${movie.title}" class="movie-card-poster" loading="lazy">
          <span class="rank-badge">#${index + 1}</span>
        </div>
        <div class="movie-card-info">
          <div class="movie-card-title" title="${movie.title}">${movie.title} (${movie.year})</div>
          <div class="movie-card-meta-row">
            <span class="movie-card-lang-pill">${mainLang}</span>
            <span class="movie-card-downloads"><i class="fas fa-arrow-down"></i> ${totalDl.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// Live Search with smooth transition matching CSS
function setupLiveSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      dropdown.classList.remove('active');
      return;
    }

    const matches = MOVIES_DATABASE.filter(item => {
      return item.title.toLowerCase().includes(query) ||
             (item.arabicTitle && item.arabicTitle.includes(query)) ||
             (item.imdbId && item.imdbId.toLowerCase().includes(query));
    });

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 0.9rem; text-align: center; color: #6b7280; font-size: 0.85rem;">
          No matches found for "${escapeText(query)}"
        </div>
      `;
    } else {
      dropdown.innerHTML = matches.map(movie => `
        <div class="search-result-item" onclick="window.location.href='movie.html?id=${movie.id}'">
          <img src="${movie.poster}" alt="${movie.title}">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 0.88rem; color: #f1f3f6;">${movie.title} <span style="color: #6b7280; font-size: 0.8rem;">(${movie.year})</span></div>
            <div class="search-result-meta">
              <span>${movie.type === 'tv' ? 'TV Show' : 'Movie'}</span>
              <span class="search-result-rating"><i class="fas fa-star"></i> ${movie.rating}</span>
              <span>${movie.subtitles ? movie.subtitles.length : 0} subtitles</span>
            </div>
          </div>
        </div>
      `).join('');
    }

    dropdown.classList.add('active');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('active');
    }
  });
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
    }
  }
}

// Auth UI Helper
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
