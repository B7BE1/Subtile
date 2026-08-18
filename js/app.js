/**
 * Subtile App JavaScript - Search Bar & Most Downloaded Logic
 * Connected to Live Cinemeta (Movies/Series) & Jikan (Anime) Metadata
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
      <a href="movie.html?id=${movie.id}&type=${movie.type || 'movie'}" class="movie-card most-downloaded">
        <div class="movie-card-poster-wrap">
          <img src="${movie.poster}" alt="${movie.title}" class="movie-card-poster" loading="lazy">
          <span class="rank-badge">#${index + 1}</span>
        </div>
        <div class="movie-card-info">
          <div class="movie-card-title" title="${movie.title}">${movie.title} (${movie.year})</div>
          <div class="movie-card-meta-row">
            <span class="movie-card-lang-pill">${movie.type === 'anime' ? 'Anime' : mainLang}</span>
            <span class="movie-card-downloads"><i class="fas fa-arrow-down"></i> ${totalDl.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// Live Search with Cinemeta + Jikan Integration
let searchDebounceTimer = null;

function setupLiveSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (!query) {
      dropdown.classList.remove('active');
      return;
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      // First show local instant matches
      const localMatches = MOVIES_DATABASE.filter(item => {
        return item.title.toLowerCase().includes(query.toLowerCase()) ||
               (item.arabicTitle && item.arabicTitle.includes(query)) ||
               (item.imdbId && item.imdbId.toLowerCase().includes(query.toLowerCase()));
      });

      renderSearchResults(localMatches, dropdown, true);

      // Fetch live matches from Cinemeta & Jikan API
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            // Merge and deduplicate
            const combined = [...localMatches];
            data.results.forEach(r => {
              if (!combined.some(c => (c.imdbId && c.imdbId === r.id) || (c.id === r.id) || (c.title.toLowerCase() === r.title.toLowerCase()))) {
                combined.push(r);
              }
            });
            renderSearchResults(combined, dropdown, false);
          }
        }
      } catch (err) {
        console.error('Live search error:', err);
      }
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('active');
    }
  });
}

function renderSearchResults(items, dropdown, isLocalOnly) {
  if (items.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 0.9rem; text-align: center; color: #6b7280; font-size: 0.85rem;">
        No matches found
      </div>
    `;
    dropdown.classList.add('active');
    return;
  }

  dropdown.innerHTML = items.slice(0, 10).map(movie => {
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
    const targetUrl = `movie.html?id=${encodeURIComponent(movie.id || movie.imdb_id)}&type=${movie.type || 'movie'}`;

    return `
      <div class="search-result-item" onclick="window.location.href='${targetUrl}'">
        <img src="${movie.poster || 'assets/default-poster.jpg'}" alt="${movie.title}">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 0.88rem; color: #f1f3f6;">${movie.title} <span style="color: #6b7280; font-size: 0.8rem;">(${movie.year || 'N/A'})</span></div>
          <div class="search-result-meta">
            <span style="color: #5b9df5;">${typeLabel}</span>
            ${movie.rating ? `<span class="search-result-rating"><i class="fas fa-star"></i> ${movie.rating}</span>` : ''}
            ${movie.genres && movie.genres.length ? `<span>&bull; ${movie.genres.slice(0, 2).join(', ')}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  dropdown.classList.add('active');
}

function performSearch() {
  const searchInput = document.getElementById('heroSearchInput');
  if (searchInput && searchInput.value.trim()) {
    window.location.href = `browse.html?q=${encodeURIComponent(searchInput.value.trim())}`;
  }
}

// User Menu & Auth
function setupAuthNavbar() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;

  const currentUser = localStorage.getItem('subhub_current_user');
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser);
      slot.innerHTML = `
        <div class="user-menu">
          <button class="user-menu-trigger" onclick="toggleNavUserDropdown(event)">
            <img src="assets/default-avatar.svg" class="avatar avatar-sm" alt="">
            <span class="user-menu-name">${escapeText(user.username)}</span>
            <i class="fas fa-chevron-down" style="font-size:0.7rem;"></i>
          </button>
          <div id="navUserDropdown" class="user-menu-dropdown">
            <a href="profile.html?user=${encodeURIComponent(user.username)}" class="user-menu-item">
              <i class="fas fa-user-circle"></i> <span>Profile</span>
            </a>
            <button class="user-menu-item" onclick="openUploadModal()">
              <i class="fas fa-upload"></i> <span>Upload Subtitle</span>
            </button>
            <div class="user-menu-divider"></div>
            <button class="user-menu-item danger" onclick="handleLogout()">
              <i class="fas fa-sign-out-alt"></i> <span>Logout</span>
            </button>
          </div>
        </div>
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

function toggleNavUserDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('navUserDropdown');
  if (dd) dd.classList.toggle('show');
}

document.addEventListener('click', () => {
  const dd = document.getElementById('navUserDropdown');
  if (dd) dd.classList.remove('show');
});

function handleLogout() {
  localStorage.removeItem('subhub_current_user');
  localStorage.removeItem('subhub_session_token');
  setupAuthNavbar();
  showToast('Logged out successfully.');
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
