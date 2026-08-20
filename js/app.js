/**
 * Subtile App JavaScript - Search Bar & Most Downloaded Logic
 * Connected to Live Cinemeta (Movies/Series) & Jikan (Anime) Metadata
 */

// Cached fetch — stores responses in sessionStorage for 10 minutes
const API_CACHE_TTL = 10 * 60 * 1000;
window.cachedFetch = async function(url, opts = {}) {
  if (opts.method && opts.method !== 'GET') return fetch(url, opts);
  const key = `api_cache_${  url}`;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key));
    if (cached && Date.now() - cached.ts < API_CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
  } catch {}
  const res = await fetch(url, opts);
  if (res.ok) {
    const data = await res.clone().json().catch(() => null);
    if (data) {
      try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
    }
  }
  return res;
};

document.addEventListener('DOMContentLoaded', () => {
  renderMostDownloaded();
  setupLiveSearch();
  setupAuthNavbar();
  if (typeof Auth !== 'undefined') Auth.onChange(setupAuthNavbar);

  // Micro-interaction: button ripple effect
  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn-ripple');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width * 100);
    const y = ((e.clientY - rect.top) / rect.height * 100);
    btn.style.setProperty('--ripple-x', `${x  }%`);
    btn.style.setProperty('--ripple-y', `${y  }%`);
    btn.classList.add('ripple-active');
    setTimeout(() => btn.classList.remove('ripple-active'), 500);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+K or Cmd+K → focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('searchInput') || document.getElementById('catalogSearchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      } else {
        window.location.href = 'browse.html';
      }
    }
    // Escape → close modals
    if (e.key === 'Escape') {
      const preview = document.getElementById('previewModal');
      if (preview && preview.classList.contains('active')) {
        preview.classList.remove('active');
        return;
      }
    }
  });
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

  const esc = (typeof Security !== 'undefined') ? Security.escapeHTML : escapeText;

  grid.innerHTML = sorted.map((movie, index) => {
    const mainLang = (movie.subtitles && movie.subtitles[0]) ? movie.subtitles[0].langName : 'Arabic';
    const totalDl = movie.subtitles 
      ? movie.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0) 
      : 14250;

    return `
      <a href="movie.html?id=${encodeURIComponent(movie.id)}&type=${encodeURIComponent(movie.type || 'movie')}" class="movie-card most-downloaded">
        <div class="movie-card-poster-wrap">
          <img src="${esc(movie.poster)}" alt="${esc(movie.title)}" class="movie-card-poster" loading="lazy" onerror="this.onerror=null; this.src='https://images.metahub.space/poster/small/tt15239678/img';">
          <span class="rank-badge">#${index + 1}</span>
        </div>
        <div class="movie-card-info">
          <div class="movie-card-title" title="${esc(movie.title)}">${esc(movie.title)} (${esc(movie.year)})</div>
          <div class="movie-card-meta-row">
            <span class="movie-card-lang-pill">${movie.type === 'anime' ? 'Anime' : esc(mainLang)}</span>
            <span class="movie-card-downloads"><i class="fas fa-arrow-down"></i> ${totalDl.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

// Live Search with Cinemeta + Jikan Integration (via /api/search — same
// ranked, deduped results as js/browse.js's catalog search, so the two
// entry points never disagree for the same query).
let searchDebounceTimer = null;
let searchAbortController = null;
let searchRequestToken = 0;

const SEARCH_HISTORY_KEY = 'subtile_search_history';
const MAX_RECENT = 6;

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveSearch(query) {
  if (!query.trim()) return;
  let recent = getRecentSearches().filter(q => q.toLowerCase() !== query.toLowerCase());
  recent.unshift(query.trim());
  if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
  try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(recent)); } catch {}
}

function clearRecentSearches() {
  try { localStorage.removeItem(SEARCH_HISTORY_KEY); } catch {}
}

function renderRecentSearches(dropdown) {
  const recent = getRecentSearches();
  if (recent.length === 0) return '';
  return `
    <div class="search-recent">
      <div class="search-recent-header">
        <span><i class="fas fa-clock"></i> Recent</span>
        <button onclick="clearRecentSearches(); document.getElementById('searchResultsDropdown').innerHTML = renderRecentSearches(document.getElementById('searchResultsDropdown')); " >Clear</button>
      </div>
      ${recent.map(q => `
        <div class="search-recent-item" onclick="document.getElementById('searchInput').value='${q.replace(/'/g, "\\'")}'; document.getElementById('searchInput').dispatchEvent(new Event('input'));">
          <i class="fas fa-history"></i> ${q}
        </div>
      `).join('')}
    </div>`;
}

function setupLiveSearch() {
  const searchInput = document.getElementById('searchInput');
  const dropdown = document.getElementById('searchResultsDropdown');

  if (!searchInput || !dropdown) return;

  searchInput.addEventListener('focus', () => {
    const query = searchInput.value.trim();
    if (!query) {
      dropdown.innerHTML = renderRecentSearches(dropdown);
      if (dropdown.querySelector('.search-recent')) dropdown.classList.add('active');
    }
  });

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    clearTimeout(searchDebounceTimer);
    if (searchAbortController) searchAbortController.abort();

    if (!query) {
      dropdown.innerHTML = renderRecentSearches(dropdown);
      if (dropdown.querySelector('.search-recent')) dropdown.classList.add('active');
      else dropdown.classList.remove('active');
      return;
    }

    const thisRequest = ++searchRequestToken;

    searchDebounceTimer = setTimeout(async () => {
      const tokens = query.toLowerCase().split(/\s+/).filter(t => t);
      const localMatches = MOVIES_DATABASE.filter(item => {
        const eng = item.title.toLowerCase();
        const ar = item.arabicTitle ? item.arabicTitle.toLowerCase() : '';
        const id = item.imdbId ? item.imdbId.toLowerCase() : (item.id ? item.id.id : '');
        return tokens.every(token => eng.includes(token) || ar.includes(token) || id.includes(token));
      });

      if (thisRequest === searchRequestToken) {
        renderSearchResults(localMatches, dropdown, true);
      }

      searchAbortController = new AbortController();
      try {
        let apiQuery = query;
        const isArabic = /[\u0600-\u06FF]/.test(query);
        if (isArabic && localMatches.length > 0) {
          apiQuery = localMatches[0].title.split(' ')[0];
        }

        const res = await fetch(`/api/search?q=${encodeURIComponent(apiQuery)}`, {
          signal: searchAbortController.signal,
        });

        if (thisRequest !== searchRequestToken) return;

        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
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
        if (err.name !== 'AbortError') {
          console.error('Live search error:', err);
        }
      }
    }, 200);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        saveSearch(query);
        dropdown.classList.remove('active');
        window.location.href = `browse.html?q=${encodeURIComponent(query)}`;
      }
    }
    if (e.key === 'Escape') dropdown.classList.remove('active');
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
      <div class="search-no-results">
        <i class="fas fa-search"></i>
        <p>No matches found</p>
      </div>
    `;
    dropdown.classList.add('active');
    return;
  }

  const esc = (typeof Security !== 'undefined') ? Security.escapeHTML : (s) => String(s ?? '');
  const safeImg = (typeof Security !== 'undefined')
    ? (url) => Security.sanitizeImageURL(url, 'https://images.metahub.space/poster/small/tt15239678/img')
    : (url) => url || 'https://images.metahub.space/poster/small/tt15398776/img';

  const recentHtml = !isLocalOnly ? '' : renderRecentSearches(dropdown);

  dropdown.innerHTML = `
    ${!isLocalOnly ? '' : recentHtml}
    ${items.slice(0, 8).map(movie => {
      const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
      const targetId = encodeURIComponent(movie.id || movie.imdb_id);
      const targetType = encodeURIComponent(movie.type || 'movie');
      const targetUrl = `movie.html?id=${targetId}&type=${targetType}`;
      const icon = movie.type === 'anime' ? 'fa-dragon' : (movie.type === 'tv' ? 'fa-tv' : 'fa-film');

      return `
        <div class="search-suggestion-item" onclick="saveSearch('${esc(movie.title).replace(/'/g, "\\'")}'); window.location.href='${targetUrl}'">
          <img class="suggestion-icon" src="${safeImg(movie.poster)}" alt="" onerror="this.style.display='none'">
          <div class="suggestion-info">
            <div class="suggestion-title">${esc(movie.title)}</div>
            <div class="suggestion-meta"><i class="fas ${icon}" style="margin-right:4px;"></i> ${typeLabel} &bull; ${esc(movie.year || movie.releaseInfo || 'N/A')} ${movie.rating ? `&bull; ★ ${  esc(movie.rating)}` : ''}</div>
          </div>
        </div>
      `;
    }).join('')}
  `;

  dropdown.classList.add('active');
}

function performSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput && searchInput.value.trim()) {
    window.location.href = `browse.html?q=${encodeURIComponent(searchInput.value.trim())}`;
  }
}

// User Menu & Auth
function setupAuthNavbar() {
  const slot = document.getElementById('navAuthSlot');
  if (!slot) return;

  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (user && user.username) {
    const safeUsername = escapeText(user.username);
    slot.innerHTML = `
      <div class="user-menu">
        <button class="user-menu-trigger" onclick="toggleNavUserDropdown(event)">
          <img src="assets/default-avatar.svg" class="avatar avatar-sm" alt="">
          <span class="user-menu-name">${safeUsername}</span>
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
  }

  slot.innerHTML = `
    <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn-auth-subdl">
      <i class="fas fa-sign-in-alt"></i> Login / Sign Up
    </a>
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
  if (typeof Auth !== 'undefined') Auth.logout();
  setupAuthNavbar();
  showToast('Logged out successfully.');
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  if (typeof switchModalAuthTab === 'function') switchModalAuthTab(tab);
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
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

async function handleAuthLogin(e) {
  e.preventDefault();
  const identifier = document.getElementById('authLoginIdentifier').value.trim();
  const password = document.getElementById('authLoginPassword').value;
  try {
    if (typeof Auth !== 'undefined') {
      await Auth.login({ identifier, password });
      closeAuthModal();
      setupAuthNavbar();
      showToast('Logged in successfully!');
    }
  } catch (err) {
    showToast(err.message || 'Login failed', true);
  }
}

async function handleAuthRegister(e) {
  e.preventDefault();
  const username = document.getElementById('authRegUsername').value.trim();
  const email = document.getElementById('authRegEmail').value.trim();
  const password = document.getElementById('authRegPassword').value;
  try {
    if (typeof Auth !== 'undefined') {
      await Auth.register({ username, email, password });
      closeAuthModal();
      setupAuthNavbar();
      showToast(`Account created! Welcome, ${  username}`);
    }
  } catch (err) {
    showToast(err.message || 'Registration failed', true);
  }
}

function switchModalAuthTab(tab) {
  const isLogin = tab === 'login';
  const tabLogin = document.getElementById('modalTabLogin');
  const tabRegister = document.getElementById('modalTabRegister');
  const loginForm = document.getElementById('modalLoginForm');
  const registerForm = document.getElementById('modalRegisterForm');

  if (tabLogin) { tabLogin.className = isLogin ? 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-neutral-950 text-center transition-all' : 'flex-1 py-2 rounded-lg text-sm font-bold text-neutral-400 text-center transition-all'; }
  if (tabRegister) { tabRegister.className = !isLogin ? 'flex-1 py-2 rounded-lg text-sm font-bold bg-white text-neutral-950 text-center transition-all' : 'flex-1 py-2 rounded-lg text-sm font-bold text-neutral-400 text-center transition-all'; }
  if (loginForm) loginForm.classList.toggle('hidden', !isLogin);
  if (registerForm) registerForm.classList.toggle('hidden', isLogin);
}

function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const type = isError ? 'error' : 'success';
  toast.className = `toast-upgraded toast-${  type}`;
  const icon = type === 'error' ? 'fa-exclamation-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle');
  const color = type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#34d399');
  toast.innerHTML = `<i class="fas ${icon}" style="color:${color}; flex-shrink:0;"></i> <span>${escapeText(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeText(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
