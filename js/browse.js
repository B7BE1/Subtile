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
 *
 * Search upgrade + project wiring (this pass):
 * - Arabic-aware local matching: folds alef forms (أ/إ/آ→ا), ta marbuta
 *   (ة→ه), alif maqsura (ى→ي) and strips diacritics before comparing, so
 *   "احمد" matches "أحمد" against MOVIES_DATABASE's arabicTitle field.
 * - Dropdown highlights the matched substring, shows a brief loading row
 *   while /api/search is in flight, and offers recent searches (kept in
 *   localStorage) when the input is focused empty.
 * - Queries under 2 characters stay local-only — no /api/search call.
 * - openAuthModal() now falls back to login.html when #authModal isn't on
 *   the page (it never was — no page in this project defines that markup),
 *   instead of silently doing nothing on click.
 * - CSS/markup fixes made in browse.html to actually connect this file:
 *   .filter-btn.active → .filter-tab-btn.active (class name never matched,
 *   so the active category tab had no highlight), plus added the missing
 *   #navAuthSlot, #toastContainer and #catalogSortSelect elements that
 *   setupAuthNavbar()/showToast()/onCatalogSort() already expected.
 */

let currentTypeFilter = 'all';
let currentSearchQuery = '';
let currentSort = 'rating';
let liveSearchResults = [];
let browseDebounceTimer = null;
const MIN_LIVE_SEARCH_LENGTH = 2;

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
    searchInput.addEventListener('focus', () => {
      if (!searchInput.value.trim()) renderRecentSearchesDropdown(dropdown);
    });

    searchInput.addEventListener('keydown', (e) => {
      const items = Array.from(dropdown.querySelectorAll('.search-item'));
      const activeIdx = items.findIndex(i => i.dataset.active === '1');

      if (e.key === 'Escape') {
        dropdown.classList.remove('active');
        return;
      }
      if (!dropdown.classList.contains('active') || items.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = activeIdx === -1
          ? (dir === 1 ? 0 : items.length - 1)
          : (activeIdx + dir + items.length) % items.length;
        // Inline style, not a CSS class — .is-active has no rule in
        // browse.html's stylesheet, so a class toggle alone rendered nothing.
        items.forEach(i => { i.style.background = ''; delete i.dataset.active; });
        items[nextIdx].style.background = 'rgba(255,255,255,0.08)';
        items[nextIdx].dataset.active = '1';
        items[nextIdx].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && activeIdx !== -1) {
        e.preventDefault();
        items[activeIdx].click();
      }
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

// ---- Search text normalization -----------------------------------------
// Folds Arabic alef/ta-marbuta/alif-maqsura variants, strips diacritics and
// tatweel, and lowercases — so "أحمد"/"احمد", "قصة"/"قصه" etc. match each
// other against MOVIES_DATABASE's arabicTitle field instead of requiring
// the exact same characters.
function normalizeSearchText(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // diacritics + tatweel
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function matchesQuery(text, normalizedQuery) {
  if (!text) return false;
  return normalizeSearchText(text).includes(normalizedQuery);
}

function localMovieMatches(query) {
  const nq = normalizeSearchText(query);
  if (!nq) return [];
  return MOVIES_DATABASE.filter(m =>
    matchesQuery(m.title, nq) || (m.arabicTitle && matchesQuery(m.arabicTitle, nq))
  );
}

// Case-insensitive literal highlight. Falls back to plain escaped text when
// the raw query isn't a literal substring (e.g. it only matched via Arabic
// normalization) — a missed highlight is a fine tradeoff for not maintaining
// a normalized-to-raw index map.
function highlightMatch(text, query) {
  const t = String(text ?? '');
  if (!query) return esc(t);
  const idx = t.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return esc(t);
  const before = t.slice(0, idx);
  const match = t.slice(idx, idx + query.length);
  const after = t.slice(idx + query.length);
  return `${esc(before)}<mark style="background: rgba(255,255,255,0.18); color: inherit; border-radius: 3px; padding: 0 2px;">${esc(match)}</mark>${esc(after)}`;
}

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
  const safeFetchJson = (url, opts) => fetch(url, opts)
    .then(r => r.ok ? r.json() : null)
    .catch(e => { if (e.name === 'AbortError') throw e; return null; });

  try {
    const promises = [];
    // Cinemeta uses skip (e.g. 0, 50, 100). We'll fetch 50 items per page.
    const skip = (page - 1) * 50;

    if (type === 'all' || type === 'movie') {
      promises.push(
        safeFetchJson(`https://v3-cinemeta.strem.io/catalog/movie/top/skip=${skip}.json`, { signal })
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
        safeFetchJson(`https://v3-cinemeta.strem.io/catalog/series/top/skip=${skip}.json`, { signal })
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

  const dropdown = document.getElementById('browseSearchDropdown');

  if (!currentSearchQuery) {
    if (dropdown) renderRecentSearchesDropdown(dropdown);
    liveSearchResults = [];
    triggerLiveTrending(currentTypeFilter, currentPage);
    return;
  }

  const localMatches = localMovieMatches(currentSearchQuery);
  if (dropdown) renderBrowseDropdown(localMatches, dropdown, currentSearchQuery);

  // Short queries stay local-only — skip hitting /api/search for noise.
  if (currentSearchQuery.length < MIN_LIVE_SEARCH_LENGTH) {
    liveSearchResults = localMatches;
    renderCatalog();
    return;
  }

  const thisRequest = ++catalogSearchRequestToken;
  browseDebounceTimer = setTimeout(() => {
    addRecentSearch(currentSearchQuery);
    if (dropdown) appendDropdownLoading(dropdown);
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

    const localMatches = localMovieMatches(q);

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
      renderBrowseDropdown(liveSearchResults, dropdown, currentSearchQuery);
    }
  }
}

function appendDropdownLoading(dropdown) {
  if (dropdown.querySelector('[data-loading-row]')) return;
  const row = document.createElement('div');
  row.setAttribute('data-loading-row', '1');
  row.style.cssText = 'padding: 0.7rem 0.9rem; text-align: center; color: #6b7280; font-size: 0.78rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; font-family: "Inter", sans-serif;';
  row.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating results...';
  dropdown.appendChild(row);
  dropdown.classList.add('active');
}

function renderBrowseDropdown(items, dropdown, query = '') {
  if (items.length === 0) {
    dropdown.innerHTML = `
      <div style="padding: 0.9rem; text-align: center; color: #6b7280; font-size: 0.85rem;">
        No matches found
      </div>
    `;
    dropdown.classList.add('active');
    return;
  }

  // Reuses the module-level esc()/safeImg() — do NOT redeclare local
  // versions here (a previous version did, with an unescaped fallback,
  // which reopened the XSS gap those helpers exist to close).
  dropdown.innerHTML = items.slice(0, 10).map(movie => {
    const typeLabel = movie.type === 'anime' ? 'Anime' : (movie.type === 'tv' ? 'TV Show' : 'Movie');
    const targetId = encodeURIComponent(movie.id || movie.imdb_id);
    const targetType = encodeURIComponent(movie.type || 'movie');
    const targetUrl = `movie.html?id=${targetId}&type=${targetType}`;

    return `
      <a href="${targetUrl}" class="search-item">
        <img src="${safeImg(movie.poster || movie.backdrop)}" alt="">
        <div>
          <div style="font-weight: 600; font-size: 0.9rem;">${highlightMatch(movie.title, query)}</div>
          <div style="font-size: 0.75rem; color: #8a8a92;">${esc(movie.year || 'N/A')} • ${typeLabel}</div>
        </div>
      </a>
    `;
  }).join('');
  dropdown.classList.add('active');
}

// ---- Recent searches -----------------------------------------------------
const RECENT_SEARCHES_KEY = 'subhub_recent_searches';

function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function addRecentSearch(q) {
  const query = q.trim();
  if (!query) return;
  try {
    let arr = getRecentSearches().filter(s => s.toLowerCase() !== query.toLowerCase());
    arr.unshift(query);
    arr = arr.slice(0, 6);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(arr));
  } catch {}
}

function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_SEARCHES_KEY); } catch {}
}

function renderRecentSearchesDropdown(dropdown) {
  const recents = getRecentSearches();
  if (recents.length === 0) {
    dropdown.classList.remove('active');
    return;
  }

  const header = `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.9rem; font-size: 0.75rem; color: #6b7280; font-family: 'Inter', sans-serif;">
      <span>Recent searches</span>
      <button type="button" onclick="clearRecentSearchesUI(event)" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 0.75rem; text-decoration: underline; font-family: 'Inter', sans-serif;">Clear</button>
    </div>
  `;
  const rows = recents.map(q => `
    <button type="button" class="search-item" data-query="${esc(q)}" onclick="applyRecentSearch(this)" style="display: flex; align-items: center; gap: 0.6rem; width: 100%; text-align: inherit; background: none; border: none; cursor: pointer; padding: 0.6rem 0.9rem; color: inherit; font-family: 'Inter', sans-serif;">
      <i class="fas fa-history" style="color: #6b7280; font-size: 0.8rem;"></i>
      <span style="font-size: 0.85rem;">${esc(q)}</span>
    </button>
  `).join('');

  dropdown.innerHTML = header + rows;
  dropdown.classList.add('active');
}

function applyRecentSearch(el) {
  const q = el.getAttribute('data-query');
  const input = document.getElementById('catalogSearchInput');
  if (input) {
    input.value = q;
    onCatalogSearch();
  }
}

function clearRecentSearchesUI(e) {
  e.stopPropagation();
  clearRecentSearches();
  const dropdown = document.getElementById('browseSearchDropdown');
  if (dropdown) dropdown.classList.remove('active');
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
  // No page in this project actually defines #authModal markup — it's
  // called from the logged-out nav button, so silently doing nothing on
  // click was a dead end. login.html is the real, working auth entry point
  // every other flow on the site already uses.
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('show');
  } else {
    window.location.href = 'login.html';
  }
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
