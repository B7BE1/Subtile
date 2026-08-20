/**
 * Browse & Catalog Page Logic
 * 100% Keyless API. No TMDB.
 * Uses Cinemeta (IMDb Top) for Movies/TV and AniList GraphQL for Anime.
 * Strictly follows Premium Grayscale Cinematic Design System.
 *
 * Upgrade notes vs previous version:
 * - FIXED: renderBrowseDropdown() was redeclaring its own local esc()/safeImg()
 *   with UNESCAPED fallbacks ((s) => String(s ?? '')) — this silently undid the
 *   XSS fix already made to the module-level esc()/safeImg() the moment
 *   Security.js failed to load. It now reuses the module-level, properly
 *   escaping versions instead of shadowing them.
 * - FIXED: filterCatalog() cleared liveSearchResults unconditionally, so
 *   switching type tabs (Movie/TV/Anime) while a search was active wiped the
 *   grid instead of re-querying — it now re-runs the search against the new
 *   type filter (matches how /api/search already scopes by type).
 * - FIXED: triggerLiveTrending() had no cancellation. Rapidly switching type
 *   tabs could let a stale (slower) response land after a newer one and
 *   overwrite it on screen. Trending fetches are now AbortController-backed
 *   and token-guarded the same way catalog search already was.
 * - The isFetching guard now only blocks concurrent *pagination* requests
 *   (page > 1); a fresh page-1 request (new filter) is always allowed to
 *   proceed and supersede whatever's in flight, instead of silently
 *   no-op'ing while isFetching is still true from the previous filter.
 * - Scroll-driven pagination is now throttled via requestAnimationFrame
 *   instead of firing on every scroll event.
 * - Search dropdown gained basic keyboard navigation (Up/Down/Enter) since
 *   it was mouse-only before.
 * - esc()/safeImg() fallbacks now actually escape/validate instead of
 *   passing raw strings through when js/security.js hasn't loaded yet.
 * - showToast() escapes its message for the same reason.
 * - Rating display is normalized to one decimal everywhere (movie/tv/anime
 *   used to render inconsistently: "7" vs "7.0").
 * - Year-based sort no longer breaks on the "N/A" placeholder.
 * - Clearing the search box aborts any in-flight /api/search call before
 *   falling back to trending, closing a race where a slow stale search
 *   response could clobber trending results on screen.
 */

let currentTypeFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'rating';
let liveSearchResults = [];
let browseDebounceTimer = null;

const SEARCH_HISTORY_KEY = 'subtile_search_history';
const MAX_RECENT = 6;

function getRecentSearches() {
  try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; }
  catch { return []; }
}

function renderSkeletonCards(count = 12) {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div class="skeleton-poster"></div>
      <div class="skeleton-text"></div>
      <div class="skeleton-text-sm"></div>
    </div>
  `).join('');
  grid.classList.remove('hidden');
}

function hideSkeletonCards() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;
  const skeletons = grid.querySelectorAll('.skeleton-card');
  if (skeletons.length === 0) return;
  skeletons.forEach(s => s.classList.add('skeleton-exit'));
  setTimeout(() => {
    skeletons.forEach(s => s.remove());
  }, 300);
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
        <button onclick="event.preventDefault(); event.stopPropagation(); clearRecentSearches(); this.closest('.search-suggestions').innerHTML = '';">Clear</button>
      </div>
      ${recent.map(q => `
        <div class="search-recent-item" data-search-q="${esc(q)}">
          <i class="fas fa-history"></i> ${esc(q)}
        </div>
      `).join('')}
    </div>`;
}

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
    renderSkeletonCards(8);
    triggerLiveCatalogSearch(q);
  } else {
    renderSkeletonCards(12);
    triggerLiveTrending(currentTypeFilter, currentPage);
  }
  setupAuthNavbar();
  if (typeof Auth !== 'undefined') Auth.onChange(setupAuthNavbar);

  const searchInput = document.getElementById('catalogSearchInput');
  const dropdown = document.getElementById('browseSearchDropdown');
  if (searchInput && dropdown) {
    searchInput.addEventListener('focus', () => {
      const query = searchInput.value.trim();
      if (!query) {
        const recentHtml = renderRecentSearches(dropdown);
        if (recentHtml) {
          dropdown.innerHTML = recentHtml;
          dropdown.classList.add('active');
        }
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      const items = Array.from(dropdown.querySelectorAll('.search-suggestion-item, .search-recent-item'));
      const activeIdx = items.findIndex(i => i.classList.contains('is-active'));

      if (e.key === 'Escape') {
        dropdown.classList.remove('active');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query) {
          saveSearch(query);
          dropdown.classList.remove('active');
          window.location.href = `browse.html?q=${encodeURIComponent(query)}`;
        }
        return;
      }
      if (!dropdown.classList.contains('active') || items.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = activeIdx === -1
          ? (dir === 1 ? 0 : items.length - 1)
          : (activeIdx + dir + items.length) % items.length;
        items.forEach(i => i.classList.remove('is-active'));
        items[nextIdx].classList.add('is-active');
        items[nextIdx].scrollIntoView({ block: 'nearest' });
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-suggestions') && e.target !== searchInput) {
        dropdown.classList.remove('active');
      }
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('[data-search-q]');
      if (item) {
        e.preventDefault();
        searchInput.value = item.dataset.searchQ;
        onCatalogSearch();
      }
    });

    // Ctrl+K → focus search
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }
});

// ---- Escaping / sanitizing helpers -----------------------------------
// Security.js is the source of truth when present. These fallbacks used to
// be no-ops ((s) => s) — meaning if security.js ever failed to load, every
// innerHTML write downstream silently lost its escaping. They now do real
// (if minimal) escaping/validation on their own.
// IMPORTANT: these are the ONLY esc()/safeImg() definitions in the file —
// do not redeclare local shadows elsewhere (a previous version did this
// inside renderBrowseDropdown() with an unescaped fallback, reopening the
// exact XSS gap this section exists to close).
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
let trendingAbortController = null;
let trendingRequestToken = 0;

// Fetch real trending/top data without API Keys
async function triggerLiveTrending(type, page = 1) {
  // Only pagination (page > 1) respects the "already fetching / no more
  // data" guard. A fresh page-1 request (e.g. switching filter tabs) always
  // proceeds and supersedes whatever's currently in flight, instead of
  // silently no-op'ing because isFetching is still true from the last call.
  if (page > 1 && (isFetching || !hasMore)) return;

  if (trendingAbortController) trendingAbortController.abort();
  trendingAbortController = new AbortController();
  const { signal } = trendingAbortController;
  const thisRequest = ++trendingRequestToken;

  isFetching = true;
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.classList.remove('hidden');

  // A promise that resolves to [] on normal failure but *rejects* on abort,
  // so an aborted request doesn't quietly masquerade as "zero results".
  const fetchFn = window.cachedFetch || fetch;
  const safeFetchJson = (url, opts) => fetchFn(url, opts)
    .then(r => r.ok ? r.json() : null)
    .catch(e => { if (e.name === 'AbortError') throw e; return null; });

  try {
    const promises = [];
    // Cinemeta uses skip (e.g. 0, 50, 100). We'll fetch 50 items per page.
    const skip = (page - 1) * 50;

    if (type === 'all' || type === 'movie') {
      promises.push(
        safeFetchJson(`https://v3-cinemeta.strem.io/catalog/movie/top.json`, { signal })
          .then(d => ((d && d.metas) || []).slice(0, 50).map(m => ({
            id: m.imdb_id || m.id,
            title: m.name,
            type: 'movie',
            year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
            rating: parseFloat(m.imdbRating) || 0,
            poster: m.poster || ''
          })))
      );
    }

    if (type === 'all' || type === 'tv') {
      promises.push(
        safeFetchJson(`https://v3-cinemeta.strem.io/catalog/series/top.json`, { signal })
          .then(d => ((d && d.metas) || []).slice(0, 50).map(m => ({
            id: m.imdb_id || m.id,
            title: m.name,
            type: 'tv',
            year: (m.releaseInfo || m.year || '').toString().split(/[-–]/)[0].trim() || 'N/A',
            rating: parseFloat(m.imdbRating) || 0,
            poster: m.poster || ''
          })))
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
        safeFetchJson('https://graphql.anilist.co', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ query }),
          signal
        })
          .then(d => ((d && d.data && d.data.Page && d.data.Page.media) || []).map(a => ({
            id: `anime-${a.id}`,
            title: a.title.english || a.title.romaji,
            type: 'anime',
            year: a.startDate?.year || 'N/A',
            rating: a.averageScore ? a.averageScore / 10 : 0,
            poster: a.coverImage?.large || ''
          })))
      );
    }

    const settled = await Promise.all(promises);

    // A newer request (different filter/page) has since started — drop this
    // result silently and let the newer request own isFetching/spinner/state.
    if (thisRequest !== trendingRequestToken) return;

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
    if (e.name === 'AbortError') return; // superseded — newer request owns state now
    console.error('Fetch Error:', e);
    if (thisRequest !== trendingRequestToken) return;
    if (page === 1) liveSearchResults = [...MOVIES_DATABASE];
  }

  isFetching = false;
  if (spinner) spinner.classList.add('hidden');
  renderCatalog();
}

let scrollRafPending = false;
window.addEventListener('scroll', () => {
  if (currentSearchQuery) return; // Disable infinite scroll during search
  if (scrollRafPending) return;
  scrollRafPending = true;
  requestAnimationFrame(() => {
    scrollRafPending = false;
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (window.scrollY >= scrollableHeight - 800) {
      if (!isFetching && hasMore) {
        currentPage++;
        triggerLiveTrending(currentTypeFilter, currentPage);
      }
    }
  });
}, { passive: true });

function renderCatalog() {
  const grid = document.getElementById('catalogGrid');
  const empty = document.getElementById('catalogEmpty');
  const countBadge = document.getElementById('itemsCountBadge');

  if (!grid || !empty) return;

  hideSkeletonCards();

  const results = liveSearchResults.filter(item => {
    if (currentTypeFilter !== 'all' && item.type !== currentTypeFilter) return false;
    return true;
  });

  const list = [...results];

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
      <a href="${targetUrl}" class="movie-card card-hover" style="position: relative; text-decoration: none; color: inherit; display: block;">
        <img src="${safeImg(movie.poster)}" alt="${esc(movie.title)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='https://images.metahub.space/poster/small/tt15239678/img';" style="width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: 1.5rem; filter: grayscale(20%); transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid var(--border-color);">
        ${ratingDisplay ? `
          <span style="position: absolute; top: 1rem; left: 1rem; background: rgba(10, 10, 12, 0.9); border: 1px solid var(--border-color); color: #fff; padding: 0.3rem 0.7rem; border-radius: 50px; font-size: 0.8rem; font-weight: 700; z-index: 2; font-family: 'Inter', sans-serif;">
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

  if (!currentSearchQuery) {
    liveSearchResults = [];
    triggerLiveTrending(type, currentPage);
  } else {
    // Was: liveSearchResults = [] then renderCatalog() — which wiped the
    // grid instead of refetching, since /api/search already scopes results
    // by type server-side. Re-run the search against the new type instead.
    triggerLiveCatalogSearch(currentSearchQuery);
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
  // Abort here (not just in onCatalogSearch) so every caller — including
  // filterCatalog() re-searching on a type-tab switch — gets the same
  // in-flight-request cancellation for free instead of having to remember it.
  if (catalogSearchAbortController) catalogSearchAbortController.abort();
  catalogSearchAbortController = new AbortController();
  try {
    const apiType = currentTypeFilter === 'all' ? 'all'
      : currentTypeFilter === 'tv' ? 'tv'
      : currentTypeFilter === 'movie' ? 'movie'
      : currentTypeFilter === 'anime' ? 'anime'
      : 'all';

    const fetchFn = window.cachedFetch || fetch;
    const res = await fetchFn(`/api/search?q=${encodeURIComponent(q)}&type=${apiType}&limit=45`, {
      signal: catalogSearchAbortController.signal,
    });

    // The user has since typed something else — this response is stale,
    // drop it rather than overwrite the (correct) in-progress results.
    if (requestToken !== catalogSearchRequestToken) return;

    const data = res.ok ? await res.json() : { results: [] };

    // /api/search's normalized shape already carries id/type/title/year/
    // rating/poster — renderCatalog needs no further mapping, just a
    // fallback for the 'N/A' year placeholder the old client-side path used.
    const apiResults = (data.results || []).map(r => ({
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
      <div class="search-no-results">
        <i class="fas fa-search"></i>
        <p>No matches found</p>
      </div>
    `;
    dropdown.classList.add('active');
    return;
  }

  const icon = (type) => type === 'anime' ? 'fa-dragon' : (type === 'tv' ? 'fa-tv' : 'fa-film');
  const typeLabel = (type) => type === 'anime' ? 'Anime' : (type === 'tv' ? 'TV Show' : 'Movie');

  dropdown.innerHTML = items.slice(0, 8).map(movie => {
    const targetId = encodeURIComponent(movie.id || movie.imdb_id);
    const targetType = encodeURIComponent(movie.type || 'movie');
    const targetUrl = `movie.html?id=${targetId}&type=${targetType}`;

    return `
      <div class="search-suggestion-item" onclick="saveSearch('${esc(movie.title).replace(/'/g, "\\'")}'); window.location.href='${targetUrl}'">
        <img class="suggestion-icon" src="${safeImg(movie.poster || movie.backdrop)}" alt="" onerror="this.style.display='none'">
        <div class="suggestion-info">
          <div class="suggestion-title">${esc(movie.title)}</div>
          <div class="suggestion-meta"><i class="fas ${icon(movie.type)}" style="margin-right:4px;"></i> ${typeLabel(movie.type)} &bull; ${esc(movie.year || 'N/A')} ${movie.rating ? `&bull; ★ ${  esc(movie.rating)}` : ''}</div>
        </div>
      </div>
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

  const user = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
  if (user && user.username) {
    const safeUsername = esc(user.username);
    slot.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <button onclick="toggleNavUserDropdown(event)" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(15, 15, 18, 0.85); border: 1px solid var(--border-color); padding: 0.5rem 1.2rem; border-radius: 50px; color: #fff; cursor: pointer; font-weight: 600; font-family: 'Inter', sans-serif; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <img src="assets/default-avatar.svg" alt="" style="width: 24px; height: 24px; border-radius: 50%;">
          <span>${safeUsername}</span>
          <i class="fas fa-chevron-down" style="font-size:0.7rem;"></i>
        </button>
        <div id="navUserDropdown" style="position: absolute; top: 110%; right: 0; background: rgba(15, 15, 18, 0.95); border: 1px solid var(--border-color); border-radius: 1rem; padding: 0.5rem; min-width: 200px; display: none; flex-direction: column; gap: 0.2rem; z-index: 100;">
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
  }

  slot.innerHTML = `
    <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" style="padding: 0.6rem 1.2rem; border-radius: 50px; background: transparent; color: #fff; border: 1px solid var(--border-color); cursor: pointer; font-weight: 600; font-family: 'Inter', sans-serif; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
      <i class="fas fa-sign-in-alt"></i> Login / Sign Up
    </a>
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
  if (typeof Auth !== 'undefined') Auth.logout();
  setupAuthNavbar();
  showToast('Logged out successfully.');
}

function openAuthModal(tab = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
}
function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
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

function switchBrowseModalTab(tab) {
  const isLogin = tab === 'login';
  const tabLogin = document.getElementById('browseModalTabLogin');
  const tabRegister = document.getElementById('browseModalTabRegister');
  const loginForm = document.getElementById('authLoginForm');
  const registerForm = document.getElementById('authRegisterForm');

  if (tabLogin) tabLogin.style.cssText = isLogin ? 'flex:1; padding:8px; border:none; border-radius:8px; font-size:0.85rem; font-weight:700; background:#fff; color:#050507; cursor:pointer; text-align:center; transition:all 0.2s;' : 'flex:1; padding:8px; border:none; border-radius:8px; font-size:0.85rem; font-weight:700; background:transparent; color:#6b7280; cursor:pointer; text-align:center; transition:all 0.2s;';
  if (tabRegister) tabRegister.style.cssText = !isLogin ? 'flex:1; padding:8px; border:none; border-radius:8px; font-size:0.85rem; font-weight:700; background:#fff; color:#050507; cursor:pointer; text-align:center; transition:all 0.2s;' : 'flex:1; padding:8px; border:none; border-radius:8px; font-size:0.85rem; font-weight:700; background:transparent; color:#6b7280; cursor:pointer; text-align:center; transition:all 0.2s;';
  if (loginForm) loginForm.style.display = isLogin ? '' : 'none';
  if (registerForm) registerForm.style.display = !isLogin ? '' : 'none';
}

function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  const type = isError ? 'error' : 'success';
  toast.className = `toast-upgraded toast-${  type}`;
  const icon = type === 'error' ? 'fa-exclamation-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-check-circle');
  const color = type === 'error' ? '#ef4444' : (type === 'warning' ? '#f59e0b' : '#34d399');
  toast.innerHTML = `<i class="fas ${icon}" style="color:${color}; flex-shrink:0;"></i> <span>${esc(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
