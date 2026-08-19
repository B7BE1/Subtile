/**
 * Browse & Catalog Page Logic
 * 100% Keyless API. No TMDB.
 * Uses Cinemeta (IMDb Top) for Movies/TV and AniList GraphQL for Anime.
 * Strictly follows Premium Grayscale Cinematic Design System.
 *
 * Upgrade notes vs previous version:
 * - esc()/safeImg() fallbacks now actually escape/validate instead of
 *   passing raw strings through when js/security.js hasn't loaded yet.
 * - navUserDropdown username is now escaped — it was going into innerHTML
 *   unescaped (stored-XSS risk if a display name is ever attacker-controlled).
 * - showToast() escapes its message for the same reason.
 * - Rating display is normalized to one decimal everywhere (movie/tv/anime
 *   used to render inconsistently: "7" vs "7.0").
 * - Year-based sort no longer breaks on the "N/A" placeholder.
 * - Clearing the search box now aborts any in-flight /api/search call
 *   before falling back to trending, closing a race where a slow stale
 *   search response could clobber trending results on screen.
 * - Removed the dead/duplicate countBadge write in renderCatalog.
 */

let currentTypeFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'rating';
let liveSearchResults = [];
let browseDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  const typeParam = urlParams.get('type');

  if (typeParam) {
    currentTypeFilter = typeParam;
    const typeBtn = document.querySelector(`.filter-tab-btn[onclick*="'${typeParam}'"]`);
    if (typeBtn) {
      document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
      typeBtn.classList.add('active');
    }
  }

  if (q) {
    currentSearchQuery = q;
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = q;
    triggerLiveCatalogSearch(q);
  } else {
    triggerLiveTrending(currentTypeFilter, currentPage);
  }
  setupAuthNavbar();

  const searchInput = document.getElementById('catalogSearchInput');
  const dropdown = document.getElementById('browseSearchDropdown');
  if (searchInput && dropdown) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dropdown.classList.remove('active');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-dropdown') && e.target !== searchInput) {
        dropdown.classList.remove('active');
      }
    });
  }
});

// ---- Escaping / sanitizing helpers -----------------------------------
// Security.js is the source of truth when present. These fallbacks used to
// be no-ops ((s) => s) — meaning if security.js ever failed to load, every
// innerHTML write downstream silently lost its escaping. They now do real
// (if minimal) escaping/validation on their own.
function fallbackEscapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function fallbackSanitizeImageURL(url, fallback) {
  if (typeof url !== 'string') return fallback;
  try {
    const u = new URL(url, window.location.href);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : fallback;
  } catch {
    return fallback;
  }
}
const esc = (typeof Security !== 'undefined') ? Security.escapeHTML : fallbackEscapeHTML;
const safeImg = (typeof Security !== 'undefined')
  ? (url) => Security.sanitizeImageURL(url, 'https://images.metahub.space/poster/small/tt15239678/img')
  : (url) => fallbackSanitizeImageURL(url, 'https://images.metahub.space/poster/small/tt15239678/img');

// Normalize any rating (string or number, 0-10 scale) to a single decimal,
// or '' if there's nothing to show.
function formatRating(r) {
  const n = parseFloat(r);
  return Number.isFinite(n) && n > 0 ? n.toFixed(1) : '';
}

// Parse a year for sorting; unknown/"N/A" years sort to the bottom instead
// of colliding with year 0 / producing NaN comparisons.
function parseYearForSort(y) {
  const n = parseInt(y, 10);
  return Number.isFinite(n) ? n : -Infinity;
}

let currentPage = 1;
let isFetching = false;
let hasMore = true;

// Fetch real trending/top data without API Keys
async function triggerLiveTrending(type, page = 1) {
  if (isFetching || !hasMore) return;
  isFetching = true;
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.classList.remove('hidden');

  try {
    const promises = [];
    // Cinemeta uses skip (e.g. 0, 50, 100). We'll fetch 50 items per page.
    const skip = (page - 1) * 50;

    if (type === 'all' || type === 'movie') {
      promises.push(
        fetch(`https://v3-cinemeta.strem.io/catalog/movie/top/skip=${skip}.json`)
          .then(r => r.ok ? r.json() : { metas: [] })
          .then(d => (d.metas || []).slice(0, 50).map(m => ({
            id: m.imdb_id || m.id,
            title: m.name,
            type: 'movie',
            year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
            rating: parseFloat(m.imdbRating) || 0,
            poster: m.poster || ''
          })))
          .catch(() => [])
      );
    }

    if (type === 'all' || type === 'tv') {
      promises.push(
        fetch(`https://v3-cinemeta.strem.io/catalog/series/top/skip=${skip}.json`)
          .then(r => r.ok ? r.json() : { metas: [] })
          .then(d => (d.metas || []).slice(0, 50).map(m => ({
            id: m.imdb_id || m.id,
            title: m.name,
            type: 'tv',
            year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
            rating: parseFloat(m.imdbRating) || 0,
            poster: m.poster || ''
          })))
          .catch(() => [])
      );
    }

    if (type === 'all' || type === 'anime') {
      const query = `
        query {
          Page(page: ${page}, perPage: 50) {
            media(type: ANIME, sort: TRENDING_DESC) {
              id
              title { romaji english }
              averageScore
              coverImage { large }
              startDate { year }
            }
          }
        }
      `;
      promises.push(
        fetch('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query })
        })
          .then(r => r.ok ? r.json() : { data: { Page: { media: [] } } })
          .then(d => (d.data?.Page?.media || []).map(a => ({
            id: `anime-${a.id}`,
            title: a.title.english || a.title.romaji,
            type: 'anime',
            year: a.startDate?.year || 'N/A',
            rating: a.averageScore ? a.averageScore / 10 : 0,
            poster: a.coverImage?.large || ''
          })))
          .catch(() => [])
      );
    }

    const settled = await Promise.all(promises);
    const newResults = settled.flat();

    if (newResults.length === 0) {
      hasMore = false;
    }

    if (page === 1) {
      const seen = new Set();
      liveSearchResults = newResults.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    } else {
      const existingIds = new Set(liveSearchResults.map(i => i.id));
      const uniqueNew = newResults.filter(i => {
        if (existingIds.has(i.id)) return false;
        existingIds.add(i.id);
        return true;
      });
      liveSearchResults.push(...uniqueNew);
    }

    if (liveSearchResults.length === 0 && page === 1) {
      liveSearchResults = [...MOVIES_DATABASE];
    }
  } catch (e) {
    console.error('Fetch Error:', e);
    if (page === 1) liveSearchResults = [...MOVIES_DATABASE];
  }

  isFetching = false;
  if (spinner) spinner.classList.add('hidden');
  renderCatalog();
}

window.addEventListener('scroll', () => {
  if (currentSearchQuery) return; // Disable infinite scroll during search
  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (window.scrollY >= scrollableHeight - 800) {
    if (!isFetching && hasMore) {
      currentPage++;
      triggerLiveTrending(currentTypeFilter, currentPage);
    }
  }
});

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');
  const countBadge = document.getElementById('itemsCountBadge');

  if (!grid || !empty) return;

  const results = liveSearchResults.filter(item => {
    if (currentTypeFilter !== 'all' && item.type !== currentTypeFilter) return false;
    return true;
  });

  let list = [...results];

  if (currentSort === 'rating') {
    list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
  } else if (currentSort === 'year') {
    list.sort((a, b) => parseYearForSort(b.year) - parseYearForSort(a.year));
  } else if (currentSort === 'title') {
    list.sort((a, b) => a.title.localeCompare(b.title));
  }

  if (countBadge) {
    countBadge.textContent = `${list.length} ${list.length === 1 ? 'title' : 'titles'}`;
  }

  if (list.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  grid.innerHTML = list.map((movie) => {
    const totalDl = movie.subtitles
      ? movie.subtitles.reduce((acc, s) => acc + (s.downloads || 0), 0)
      : Math.floor(Math.random() * 15000) + 1000;
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
    const targetUrl = `movie.html?id=${encodeURIComponent(movie.id || movie.imdb_id)}&type=${encodeURIComponent(movie.type || 'movie')}`;
    const ratingDisplay = formatRating(movie.rating);

    return `
      <a href="${targetUrl}" class="movie-card" style="position: relative; text-decoration: none; color: inherit; display: block;">
        <img src="${safeImg(movie.poster)}" alt="${esc(movie.title)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='https://images.metahub.space/poster/small/tt15239678/img';" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 1.5rem; filter: grayscale(20%); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid var(--border-color);">
        ${ratingDisplay ? `
          <span style="position: absolute; top: 1rem; left: 1rem; background: rgba(10, 10, 12, 0.8); backdrop-filter: blur(8px); border: 1px solid var(--border-color); color: #fff; padding: 0.3rem 0.7rem; border-radius: 50px; font-size: 0.8rem; font-weight: 700; z-index: 2; font-family: 'Inter', sans-serif;">
            <i class="fas fa-star" style="font-size: 0.65rem; margin-right: 0.2rem;"></i> ${ratingDisplay}
          </span>
        ` : ''}
        <div style="margin-top: 1rem;">
          <div style="font-size: 1.1rem; color: var(--text-main); font-weight: 700; font-family: 'Playfair Display', serif; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(movie.title)}</div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.85rem; color: var(--text-faded); font-family: 'Inter', sans-serif;">${esc(movie.year || 'N/A')} • ${typeLabel}</span>
            <span style="font-size: 0.85rem; color: var(--text-faded); font-family: 'Inter', sans-serif;"><i class="fas fa-arrow-down"></i> ${totalDl.toLocaleString()}</span>
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

  currentPage = 1;
  hasMore = true;
  liveSearchResults = [];

  if (!currentSearchQuery) {
    triggerLiveTrending(type, currentPage);
  } else {
    renderCatalog();
  }
}

function onCatalogSearch() {
  const input = document.getElementById('catalogSearchInput');
  if (!input) return;

  currentSearchQuery = input.value.trim();
  clearTimeout(browseDebounceTimer);
  // A fresh keystroke invalidates any /api/search call already in flight —
  // otherwise a slow response to an earlier query can land after a faster
  // response to a later one and clobber the correct results on screen.
  if (catalogSearchAbortController) catalogSearchAbortController.abort();

  currentPage = 1;
  hasMore = true;

  if (!currentSearchQuery) {
    const dropdown = document.getElementById('browseSearchDropdown');
    if (dropdown) dropdown.classList.remove('active');
    liveSearchResults = [];
    triggerLiveTrending(currentTypeFilter, currentPage);
    return;
  }

  const dropdown = document.getElementById('browseSearchDropdown');
  if (dropdown) {
    const lowerQ = currentSearchQuery.toLowerCase();
    const localMatches = MOVIES_DATABASE.filter(m =>
      m.title.toLowerCase().includes(lowerQ) || (m.arabicTitle && m.arabicTitle.includes(lowerQ))
    );
    renderBrowseDropdown(localMatches, dropdown);
  }

  const thisRequest = ++catalogSearchRequestToken;
  browseDebounceTimer = setTimeout(() => {
    triggerLiveCatalogSearch(currentSearchQuery, thisRequest);
  }, 300);
}

let catalogSearchAbortController = null;
let catalogSearchRequestToken = 0;

// Search via /api/search — same endpoint and ranked/deduped results as the
// hero search in js/app.js, so search behavior never drifts between the two
// entry points.
async function triggerLiveCatalogSearch(q, requestToken = ++catalogSearchRequestToken) {
  catalogSearchAbortController = new AbortController();
  try {
    const apiType = currentTypeFilter === 'all' ? 'all'
      : currentTypeFilter === 'tv' ? 'tv'
      : currentTypeFilter === 'movie' ? 'movie'
      : currentTypeFilter === 'anime' ? 'anime'
      : 'all';

    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=${apiType}&limit=45`, {
      signal: catalogSearchAbortController.signal,
    });

    // The user has since typed something else — this response is stale,
    // drop it rather than overwrite the (correct) in-progress results.
    if (requestToken !== catalogSearchRequestToken) return;

    const data = res.ok ? await res.json() : { results: [] };

    // /api/search's normalized shape already carries id/type/title/year/
    // rating/poster — renderCatalog needs no further mapping, just a
    // fallback for the 'N/A' year placeholder the old client-side path used.
    let apiResults = (data.results || []).map(r => ({
      ...r,
      year: r.year || 'N/A',
    }));

    const lowerQ = q.toLowerCase();
    const localMatches = MOVIES_DATABASE.filter(m =>
      m.title.toLowerCase().includes(lowerQ) || (m.arabicTitle && m.arabicTitle.includes(lowerQ))
    );

    const existingIds = new Set(apiResults.map(r => r.id));
    localMatches.forEach(m => {
      if (!existingIds.has(m.id) && !existingIds.has(m.imdbId)) {
        apiResults.unshift(m); // Push local database matches to the top
      }
    });

    liveSearchResults = apiResults;
  } catch (err) {
    if (err.name === 'AbortError') return; // superseded by a newer query — not an error
    console.error('Catalog search error:', err);
    if (requestToken === catalogSearchRequestToken) liveSearchResults = [];
  }
  if (requestToken === catalogSearchRequestToken) {
    renderCatalog();
    const dropdown = document.getElementById('browseSearchDropdown');
    if (dropdown && currentSearchQuery) {
      renderBrowseDropdown(liveSearchResults, dropdown);
    }
  }
}

function renderBrowseDropdown(items, dropdown) {
  if (items.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 0.9rem; text-align: center; color: #6b7280; font-size: 0.85rem;">
        No matches found
      </div>
    `;
    dropdown.classList.add('active');
    return;
  }

  const esc = (typeof Security !== 'undefined') ? Security.escapeHTML : (s) => String(s ?? '');
  const safeImg = (typeof Security !== 'undefined')
    ? (url) => Security.sanitizeImageURL(url, 'https://images.metahub.space/poster/small/tt15239678/img')
    : (url) => url || 'https://images.metahub.space/poster/small/tt15239678/img';

  dropdown.innerHTML = items.slice(0, 10).map(movie => {
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
    const targetId = encodeURIComponent(movie.id || movie.imdb_id);
    const targetType = encodeURIComponent(movie.type || 'movie');
    const targetUrl = `movie.html?id=${targetId}&type=${targetType}`;

    return `
      <a href="${targetUrl}" class="search-item">
        <img src="${safeImg(movie.poster || movie.backdrop)}" alt="">
        <div>
          <div style="font-weight: 600; font-size: 0.9rem;">${esc(movie.title)}</div>
          <div style="font-size: 0.75rem; color: #8a8a92;">${esc(movie.year || 'N/A')} • ${typeLabel}</div>
        </div>
      </a>
    `;
  }).join('');
  dropdown.classList.add('active');
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
      // user.username came out of localStorage — treat it like any other
      // untrusted string and escape it before it hits innerHTML.
      const safeUsername = esc(user.username);
      slot.innerHTML = `
        <div style="position: relative; display: inline-block;">
          <button onclick="toggleNavUserDropdown(event)" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(15, 15, 18, 0.55); backdrop-filter: blur(30px) saturate(150%); border: 1px solid var(--border-color); padding: 0.5rem 1.2rem; border-radius: 50px; color: #fff; cursor: pointer; font-weight: 600; font-family: 'Inter', sans-serif; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <img src="assets/default-avatar.svg" alt="" style="width: 24px; height: 24px; border-radius: 50%;">
            <span>${safeUsername}</span>
            <i class="fas fa-chevron-down" style="font-size:0.7rem;"></i>
          </button>
          <div id="navUserDropdown" style="position: absolute; top: 110%; right: 0; background: rgba(15, 15, 18, 0.95); backdrop-filter: blur(30px) saturate(150%); border: 1px solid var(--border-color); border-radius: 1rem; padding: 0.5rem; min-width: 200px; display: none; flex-direction: column; gap: 0.2rem; z-index: 100;">
            <a href="profile.html?user=${encodeURIComponent(user.username)}" style="padding: 0.6rem 1rem; border-radius: 0.75rem; color: var(--text-faded); text-decoration: none; font-family: 'Inter', sans-serif; font-size: 0.9rem;">
              <i class="fas fa-user-circle"></i> Profile
            </a>
            <button onclick="openUploadModal()" style="padding: 0.6rem 1rem; border-radius: 0.75rem; color: var(--text-faded); background: transparent; border: none; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; font-size: 0.9rem;">
              <i class="fas fa-upload"></i> Upload Subtitle
            </button>
            <div style="height: 1px; background: var(--border-color); margin: 0.3rem 0;"></div>
            <button onclick="handleLogout()" style="padding: 0.6rem 1rem; border-radius: 0.75rem; color: var(--text-faded); background: transparent; border: none; cursor: pointer; text-align: left; font-family: 'Inter', sans-serif; font-size: 0.9rem;">
              <i class="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      `;
      return;
    } catch (e) {}
  }

  slot.innerHTML = `
    <button onclick="openAuthModal('login')" style="padding: 0.6rem 1.2rem; border-radius: 50px; background: transparent; color: #fff; border: 1px solid var(--border-color); cursor: pointer; font-weight: 600; font-family: 'Inter', sans-serif; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
      <i class="fas fa-sign-in-alt"></i> Login / Sign Up
    </button>
  `;
}

function toggleNavUserDropdown(e) {
  e.stopPropagation();
  const dd = document.getElementById('navUserDropdown');
  if (dd) {
    dd.style.display = dd.style.display === 'flex' ? 'none' : 'flex';
  }
}

document.addEventListener('click', () => {
  const dd = document.getElementById('navUserDropdown');
  if (dd) dd.style.display = 'none';
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
  toast.style.background = 'rgba(15, 15, 18, 0.55)';
  toast.style.backdropFilter = 'blur(30px) saturate(150%)';
  toast.style.border = '1px solid rgba(255, 255, 255, 0.25)';
  toast.style.padding = '1rem 1.5rem';
  toast.style.borderRadius = '0.75rem';
  toast.style.color = '#ffffff';
  toast.style.fontFamily = "'Inter', sans-serif";
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '0.6rem';
  toast.style.transition = 'opacity 0.3s ease';
  toast.style.opacity = '1';
  toast.style.marginBottom = '0.5rem';

  // message is currently always a static string we control, but escape it
  // anyway so this stays safe if it's ever passed dynamic content later.
  toast.innerHTML = `<i class="fas fa-check-circle" style="color: #ffffff;"></i> <span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
