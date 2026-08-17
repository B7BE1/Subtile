/**
 * JavaScript logic for Homepage (SubHub / SubDL style)
 */

document.addEventListener('DOMContentLoaded', () => {
  renderTrendingMovies('all');
  renderRecentSubtitles();
  setupLiveSearch();
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
          <i class="fas fa-closed-captioning"></i> ${movie.subtitles.length}
        </span>
        <div class="poster-overlay">
          <span class="badge ${movie.type === 'tv' ? 'badge-tv' : 'badge-movie'}">
            ${movie.type === 'tv' ? 'مسلسل' : 'فيلم'}
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

// عرض أحدث ملفات الترجمة المرفوعة
function renderRecentSubtitles() {
  const tbody = document.getElementById('recentSubtitlesBody');
  if (!tbody) return;

  const recent = getRecentSubtitles();

  tbody.innerHTML = recent.map(sub => `
    <tr>
      <td>
        <span class="badge ${sub.language === 'ar' ? 'badge-lang-ar' : 'badge-lang-en'}">
          ${sub.langFlag} ${sub.langName}
        </span>
      </td>
      <td>
        <div class="sub-title-cell">
          <a href="movie.html?id=${sub.movieId}" class="sub-release-name">${sub.release}</a>
          <span class="sub-movie-name">
            <a href="movie.html?id=${sub.movieId}" style="color: var(--accent-secondary);">${sub.movieTitle} (${sub.movieYear})</a>
            ${sub.season ? ` • S${sub.season.toString().padStart(2, '0')}${sub.episode !== 'All' ? 'E' + sub.episode.toString().padStart(2, '0') : ' (الموسم كامل)'}` : ''}
          </span>
        </div>
      </td>
      <td>
        <span class="badge badge-quality">${sub.quality}</span>
        <span class="badge" style="background: rgba(255,255,255,0.05);">${sub.format}</span>
      </td>
      <td>
        <span style="color: var(--text-secondary); font-size: 0.85rem;"><i class="fas fa-user-circle"></i> ${sub.uploader}</span>
      </td>
      <td>
        <span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fas fa-download"></i> ${sub.downloads.toLocaleString()}</span>
      </td>
      <td>
        <button class="btn btn-primary sub-action-btn" onclick="downloadSubtitle('${sub.id}', '${sub.release}', '${sub.format}')">
          <i class="fas fa-download"></i> تحميل
        </button>
      </td>
    </tr>
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

    // Show loading skeleton
    dropdown.innerHTML = `
      <div style="padding: 1.2rem; text-align: center; color: var(--text-muted);">
        <i class="fas fa-spinner fa-spin"></i> جاري البحث...
      </div>
    `;
    dropdown.classList.add('show');

    searchTimeout = setTimeout(async () => {
      const typeParam = selectedType === 'all' ? 'multi' : selectedType;
      const matches = await tmdb.search(query, typeParam);

      if (!matches || matches.length === 0) {
        dropdown.innerHTML = `
          <div style="padding: 1.2rem; text-align: center; color: var(--text-muted);">
            <i class="fas fa-search"></i> لم يتم العثور على نتائج لـ "${query}"
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
                <span><i class="fas fa-star" style="color: var(--accent-secondary);"></i> ${movie.rating}</span>
              </div>
            </div>
          </div>
        `).join('');
      }
    }, 500); // 500ms debounce
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      dropdown.classList.remove('show');
    }
  });
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
      showToast('لم يتم العثور على نتائج');
    }
  }
}

// دالة تحميل ملف الترجمة وتوليد ملف .srt
function downloadSubtitle(subId, releaseName, format = 'SRT') {
  const srtSampleContent = `1
00:00:05,000 --> 00:00:09,000
مرحباً بكم في فيلم/مسلسل ${releaseName}
تمت الترجمة بواسطة فريق SubHub

2
00:00:10,000 --> 00:00:15,000
نتمنى لكم مشاهدة ممتعة!
Enjoy the movie with synced subtitles.
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
  showToast('تم استلام ملف الترجمة ومراجعته بنجاح! شكراً لمساهمتك.');
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
