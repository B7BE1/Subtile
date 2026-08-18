/**
 * Browse & Catalog Page Logic (Connected to Cinemeta & Jikan)
 */

let currentTypeFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'downloads';
let liveSearchResults = [];
let browseDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  if (q) {
    currentSearchQuery = q;
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = q;
    triggerLiveCatalogSearch(q);
  } else {
    renderCatalog();
  }
  setupAuthNavbar();
});

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  const countBadge = document.getElementById('itemsCountBadge');
  if (!grid) return;

  let list = liveSearchResults.length > 0 ? [...liveSearchResults] : [...MOVIES_DATABASE];

  // Filter by Type
  if (currentTypeFilter !== 'all') {
    list = list.filter(item => item.type === currentTypeFilter);
  }

  // Filter by Search Query (if filtering local)
  if (currentSearchQuery && liveSearchResults.length === 0) {
    const q = currentSearchQuery.toLowerCase();
    list = list.filter(item => 
      item.title.toLowerCase().includes(q) ||
      (item.arabicTitle && item.arabicTitle.includes(q)) ||
      (item.genres && item.genres.some(g => g.toLowerCase().includes(q)))
    );
  }

  // Sort
  if (currentSort === 'downloads') {
    list.sort((a, b) => {
      const aDl = a.subtitles ? a.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) : 0;
      const bDl = b.subtitles ? b.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) : 0;
      return bDl - aDl;
    });
  } else if (currentSort === 'rating') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (currentSort === 'year') {
    list.sort((a, b) => (b.year || 0) - (a.year || 0));
  } else if (currentSort === 'title') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'title' : 'titles'}`;
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-film" style="font-size: 2rem; margin-bottom: 0.8rem; display: block;"></i>
        <div>No titles found matching your criteria.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map((movie) => {
    const mainLang = (movie.subtitles && movie.subtitles[0]) ? movie.subtitles[0].langName : 'Arabic';
    const totalDl = movie.subtitles 
      ? movie.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) 
      : 1200;
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
    const targetUrl = `movie.html?id=${encodeURIComponent(movie.id || movie.imdb_id)}&type=${movie.type || 'movie'}`;

    return `
      <a href="${targetUrl}" class="movie-card">
        <div class="movie-card-poster-wrap">
          <img src="${movie.poster || 'https://images.metahub.space/poster/small/tt15239678/img'}" alt="${movie.title}" class="movie-card-poster" loading="lazy" onerror="this.onerror=null; this.src='https://images.metahub.space/poster/small/tt15239678/img';">
          ${movie.rating ? `
            <span class="rank-badge" style="background: rgba(18, 21, 27, 0.85); backdrop-filter: blur(4px); border: 1px solid #23262e; color: #f5c518;">
              <i class="fas fa-star" style="font-size: 0.65rem;"></i> ${movie.rating}
            </span>
          ` : ''}
        </div>
        <div class="movie-card-info">
          <div class="movie-card-title" title="${movie.title}">${movie.title} (${movie.year || 'N/A'})</div>
          <div class="movie-card-meta-row">
            <span class="movie-card-lang-pill">${typeLabel}</span>
            <span class="movie-card-downloads"><i class="fas fa-arrow-down"></i> ${totalDl.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function filterCatalog(type, btn) {
  currentTypeFilter = type;
  document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCatalog();
}

function onCatalogSearch() {
  const input = document.getElementById('catalogSearchInput');
  if (!input) return;

  currentSearchQuery = input.value.trim();
  clearTimeout(browseDebounceTimer);

  if (!currentSearchQuery) {
    liveSearchResults = [];
    renderCatalog();
    return;
  }

  browseDebounceTimer = setTimeout(() => {
    triggerLiveCatalogSearch(currentSearchQuery);
  }, 250);
}

async function triggerLiveCatalogSearch(q) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${currentTypeFilter}`);
    if (res.ok) {
      const data = await res.json();
      liveSearchResults = data.results || [];
    } else {
      liveSearchResults = [];
    }
  } catch (err) {
    console.error('Catalog live search error:', err);
    liveSearchResults = [];
  }
  renderCatalog();
}

function onCatalogSort() {
  const select = document.getElementById('catalogSortSelect');
  if (select) {
    currentSort = select.value;
    renderCatalog();
  }
}

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
            <span class="user-menu-name">${user.username}</span>
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
  if (modal) modal.classList.add('show');
}
function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('show');
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
