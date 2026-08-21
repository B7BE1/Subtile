"use strict";

function timeAgo(ts) {
  var diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return Math.floor(diff / 86400000) + 'd ago';
}

function escapeText(s) {
  var d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
var DownloadHistory = (function() {
  var KEY = 'subtile_download_history';
  var MAX = 50;
  function getAll() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; } }
  function add(item) {
    var list = getAll().filter(function(i) { return i.id !== item.id; });
    list.unshift({ id: item.id || String(Date.now()), title: item.title || 'Unknown', type: item.type || 'movie', poster: item.poster || '', format: item.format || 'srt', language: item.language || '', timestamp: Date.now() });
    if (list.length > MAX) list.length = MAX;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {}
  }
  function remove(id) { var list = getAll().filter(function(i) { return i.id !== id; }); try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch(e) {} }
  function render(containerId, maxItems) {
    maxItems = maxItems || 10;
    var container = document.getElementById(containerId);
    if (!container) return;
    var list = getAll().slice(0, maxItems);
    if (list.length === 0) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:#6b7280;"><i class="fas fa-clock" style="font-size:1.5rem;opacity:0.5;display:block;margin-bottom:0.5rem;"></i><p style="font-size:0.85rem;">No downloads yet</p></div>'; return; }
    container.innerHTML = list.map(function(item) {
      var eid = escapeAttr(item.id);
      return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.8rem;border-radius:10px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseleave="this.style.background=\'transparent\'" onclick="window.location.href=\'movie.html?id=' + eid + '&type=' + escapeAttr(item.type) + '\'">' +
        '<img src="' + escapeAttr(item.poster) + '" onerror="this.style.display=\'none\'" style="width:32px;height:48px;border-radius:6px;object-fit:cover;background:#1a1a1f;">' +
        '<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:600;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeText(item.title) + '</div>' +
        '<div style="font-size:0.7rem;color:#6b7280;">' + escapeText(item.format.toUpperCase()) + ' &middot; ' + timeAgo(item.timestamp) + '</div></div>' +
        '<button onclick="event.stopPropagation();DownloadHistory.remove(\'' + eid + '\');DownloadHistory.render(\'' + containerId + '\',' + maxItems + ');" style="background:none;border:none;color:#6b7280;cursor:pointer;padding:4px;font-size:0.75rem;"><i class="fas fa-times"></i></button></div>';
    }).join('');
  }
  return { getAll: getAll, add: add, remove: remove, clear: clear, render: render };
})();

var Favorites = (function() {
  var KEY = 'subtile_favorites';
  function getAll() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; } }
  function isFav(id) { return getAll().some(function(i) { return i.id === id; }); }
  function toggle(item) {
    var list = getAll();
    if (isFav(item.id)) { list = list.filter(function(i) { return i.id !== item.id; }); }
    else { list.unshift({ id: item.id, title: item.title || 'Unknown', type: item.type || 'movie', poster: item.poster || '', rating: item.rating || 0, year: item.year || '', addedAt: Date.now() }); }
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {}
    return isFav(item.id);
  }
  function remove(id) { var list = getAll().filter(function(i) { return i.id !== id; }); try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {} }
  function render(containerId, maxItems) {
    maxItems = maxItems || 20;
    var container = document.getElementById(containerId);
    if (!container) return;
    var list = getAll().slice(0, maxItems);
    if (list.length === 0) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:#6b7280;"><i class="fas fa-heart" style="font-size:1.5rem;opacity:0.5;display:block;margin-bottom:0.5rem;"></i><p style="font-size:0.85rem;">No favorites yet</p></div>'; return; }
    container.innerHTML = list.map(function(item) {
      var eid = escapeAttr(item.id);
      return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.8rem;border-radius:10px;cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseleave="this.style.background=\'transparent\'" onclick="window.location.href=\'movie.html?id=' + eid + '&type=' + escapeAttr(item.type) + '\'">' +
        '<img src="' + escapeAttr(item.poster) + '" onerror="this.style.display=\'none\'" style="width:32px;height:48px;border-radius:6px;object-fit:cover;background:#1a1a1f;">' +
        '<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:600;color:#e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeText(item.title) + '</div>' +
        '<div style="font-size:0.7rem;color:#6b7280;">' + (item.year || '') + (item.rating ? ' &middot; &#9733; ' + Number(item.rating).toFixed(1) : '') + '</div></div>' +
        '<button onclick="event.stopPropagation();Favorites.remove(\'' + eid + '\');Favorites.render(\'' + containerId + '\',' + maxItems + ');" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:4px;font-size:0.75rem;"><i class="fas fa-heart"></i></button></div>';
    }).join('');
  }
  function renderButton(containerId, item) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var fav = isFav(item.id);
    var s = fav ? 'border-color:rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:#ef4444;' : 'border-color:rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#9ca3af;';
    container.innerHTML = '<button onclick="Favorites.toggle(JSON.parse(this.dataset.item));Favorites.renderButton(\'' + containerId + '\',JSON.parse(this.dataset.item));" data-item=\'' + JSON.stringify(item).replace(/'/g, "&#39;") + '\' style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.5rem 1rem;border-radius:10px;border:1px solid;cursor:pointer;font-size:0.8rem;font-weight:600;transition:all 0.2s;' + s + '"><i class="fas fa-heart"></i> ' + (fav ? 'Favorited' : 'Favorite') + '</button>';
  }
  return { getAll: getAll, isFav: isFav, toggle: toggle, remove: remove, render: render, renderButton: renderButton };
})();

var SubRatings = (function() {
  var KEY = 'subtile_sub_ratings';
  function getAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; } }
  function get(subId) { return getAll()[subId] || null; }
  function set(subId, rating, comment) {
    comment = comment || '';
    var all = getAll();
    all[subId] = { rating: Math.min(5, Math.max(1, Math.round(rating))), comment: comment, timestamp: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(e) {}
  }
  function remove(subId) { var all = getAll(); delete all[subId]; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(e) {} }
  function renderStars(subId, currentRating) {
    currentRating = currentRating || 0;
    var html = '<div class="star-interactive" data-sub="' + escapeAttr(subId) + '">';
    for (var i = 1; i <= 5; i++) {
      var active = i <= currentRating;
      html += '<i class="fas fa-star' + (active ? ' active' : '') + '" data-rating="' + i + '" onclick="SubRatings.set(\'' + escapeAttr(subId) + '\',' + i + ');SubRatings.refreshStars(\'' + escapeAttr(subId) + '\');" style="cursor:pointer;font-size:0.9rem;color:' + (active ? '#fbbf24' : 'rgba(255,255,255,0.15)') + ';transition:color 0.15s,transform 0.15s;" onmouseenter="this.style.transform=\'scale(1.3)\'" onmouseleave="this.style.transform=\'scale(1)\'"></i>';
    }
    html += '</div>';
    return html;
  }
  function refreshStars(subId) {
    var rating = get(subId);
    var stars = document.querySelectorAll('.star-interactive[data-sub="' + subId + '"] i');
    stars.forEach(function(star) {
      var val = parseInt(star.getAttribute('data-rating'));
      var active = rating && val <= rating.rating;
      star.classList.toggle('active', active);
      star.style.color = active ? '#fbbf24' : 'rgba(255,255,255,0.15)';
    });
  }
  return { getAll: getAll, get: get, set: set, remove: remove, renderStars: renderStars, refreshStars: refreshStars };
})();

var LanguageFilter = (function() {
  var LANGUAGES = [
    { code: 'all', label: 'All Languages', flag: '\uD83C\uDF10' },
    { code: 'en', label: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
    { code: 'ar', label: 'Arabic', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
    { code: 'fr', label: 'French', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
    { code: 'es', label: 'Spanish', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
    { code: 'de', label: 'German', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
    { code: 'tr', label: 'Turkish', flag: '\uD83C\uDDF9\uD83C\uDDF7' },
    { code: 'pt', label: 'Portuguese', flag: '\uD83C\uDDE7\uD83C\uDDF7' },
    { code: 'ja', label: 'Japanese', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
    { code: 'ko', label: 'Korean', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
    { code: 'zh', label: 'Chinese', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
    { code: 'hi', label: 'Hindi', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
    { code: 'he', label: 'Hebrew', flag: '\uD83C\uDDEE\uD83C\uDDF1' }
  ];
  var KEY = 'subtile_lang_filter';
  function get() { try { return localStorage.getItem(KEY) || 'all'; } catch(e) { return 'all'; } }
  function set(code) { try { localStorage.setItem(KEY, code); } catch(e) {} }
  function matchesFilter(subLanguage) {
    var filter = get();
    if (filter === 'all' || !subLanguage) return true;
    var lang = subLanguage.toLowerCase();
    var map = { en: ['english','eng'], ar: ['arabic','ara'], fr: ['french','fre','fra'], es: ['spanish','spa'], de: ['german','ger','deu'], tr: ['turkish','tur'], pt: ['portuguese','por','brazilian'], ja: ['japanese','jpn'], ko: ['korean','kor'], zh: ['chinese','zho','chs','cht'], hi: ['hindi','hin'], he: ['hebrew','heb'] };
    var matches = map[filter];
    return matches ? matches.some(function(m) { return lang.indexOf(m) !== -1; }) : true;
  }
  function renderDropdown(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var current = get();
    var currentLang = LANGUAGES.find(function(l) { return l.code === current; }) || LANGUAGES[0];
    var options = LANGUAGES.map(function(l) {
      return '<option value="' + l.code + '"' + (l.code === current ? ' selected' : '') + '>' + l.flag + ' ' + l.label + '</option>';
    }).join('');
    container.innerHTML = '<select id="langFilterSelect" data-custom onchange="LanguageFilter.set(this.value);if(typeof onLanguageFilterChange===\'function\')onLanguageFilterChange();">' + options + '</select>';
    if (typeof CustomSelect !== 'undefined') {
      var sel = document.getElementById('langFilterSelect');
      if (sel) CustomSelect.create(sel);
    }
  }
  return { get: get, set: set, matchesFilter: matchesFilter, renderDropdown: renderDropdown, LANGUAGES: LANGUAGES };
})();

var ViewToggle = (function() {
  var KEY = 'subtile_view_mode';
  function get() { try { return localStorage.getItem(KEY) || 'grid'; } catch(e) { return 'grid'; } }
  function set(mode) { try { localStorage.setItem(KEY, mode); } catch(e) {} if (typeof onModeChange === 'function') onModeChange(); }
  function renderToggle(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var mode = get();
    var gBg = mode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent';
    var gClr = mode === 'grid' ? '#fff' : '#6b7280';
    var lBg = mode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent';
    var lClr = mode === 'list' ? '#fff' : '#6b7280';
    container.innerHTML = '<div style="display:flex;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;">' +
      '<button onclick="ViewToggle.set(\'grid\')" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:' + gBg + ';color:' + gClr + ';border:none;cursor:pointer;transition:all 0.2s;" title="Grid view"><i class="fas fa-th" style="font-size:0.7rem;"></i></button>' +
      '<button onclick="ViewToggle.set(\'list\')" style="width:32px;height:32px;display:flex;align-items:center;justify-content:center;background:' + lBg + ';color:' + lClr + ';border:none;cursor:pointer;transition:all 0.2s;" title="List view"><i class="fas fa-list" style="font-size:0.7rem;"></i></button></div>';
  }
  return { get: get, set: set, renderToggle: renderToggle };
})();

var KeyboardShortcuts = (function() {
  function init() {
    document.addEventListener('keydown', function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch(e.key.toLowerCase()) {
        case 'd':
          var dlBtn = document.querySelector('.download-btn, #heroDownloadBtn');
          if (dlBtn) { dlBtn.click(); e.preventDefault(); }
          break;
        case 'p':
          var pvBtn = document.querySelector('.preview-btn');
          if (pvBtn) { pvBtn.click(); e.preventDefault(); }
          break;
        case 'f':
          if (!e.ctrlKey && !e.metaKey) {
            var favBtn = document.querySelector('[onclick*="Favorites.toggle"]');
            if (favBtn) { favBtn.click(); e.preventDefault(); }
          }
          break;
        case '/':
          var searchInput = document.getElementById('searchInput') || document.getElementById('catalogSearchInput');
          if (searchInput) { searchInput.focus(); e.preventDefault(); }
          break;
      }
    });
  }
  return { init: init };
})();

/* ===== 8. Subtitle Comments ===== */
var SubComments = (function() {
  var KEY = 'subtile_comments';
  function getAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e) { return {}; } }
  function get(subId) { return getAll()[subId] || []; }
  function add(subId, text, author) {
    author = author || 'Anonymous';
    var all = getAll();
    if (!all[subId]) all[subId] = [];
    all[subId].unshift({ text: text, author: author, timestamp: Date.now() });
    if (all[subId].length > 50) all[subId].length = 50;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(e) {}
  }
  function remove(subId, index) {
    var all = getAll();
    if (all[subId]) { all[subId].splice(index, 1); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch(e) {} }
  }
  function render(subId, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var comments = get(subId);
    var html = '<div style="margin-top:0.5rem;">';
    if (comments.length === 0) {
      html += '<p style="font-size:0.75rem; color:#6b7280;">No comments yet</p>';
    } else {
      comments.forEach(function(c, i) {
        html += '<div style="display:flex; gap:0.5rem; padding:0.4rem 0; border-bottom:1px solid rgba(255,255,255,0.04);">' +
          '<div style="width:24px; height:24px; border-radius:50%; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:0.6rem; color:#9ca3af; flex-shrink:0;">' + escapeText(c.author.charAt(0).toUpperCase()) + '</div>' +
          '<div style="flex:1; min-width:0;">' +
            '<div style="font-size:0.7rem; font-weight:600; color:#d1d5db;">' + escapeText(c.author) + ' <span style="color:#6b7280; font-weight:400;">' + timeAgo(c.timestamp) + '</span></div>' +
            '<div style="font-size:0.75rem; color:#9ca3af; margin-top:0.15rem;">' + escapeText(c.text) + '</div>' +
          '</div>' +
        '</div>';
      });
    }
    html += '<div style="display:flex; gap:0.4rem; margin-top:0.5rem;">' +
      '<input id="commentInput-' + subId + '" type="text" placeholder="Add a comment..." style="flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.4rem 0.6rem; color:#fff; font-size:0.75rem; outline:none;">' +
      '<button onclick="SubComments.submit(\'' + escapeAttr(subId) + '\',\'' + containerId + '\')" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:0.4rem 0.8rem; color:#9ca3af; font-size:0.75rem; cursor:pointer; font-weight:600;">Post</button>' +
    '</div></div>';
    container.innerHTML = html;
  }
  function submit(subId, containerId) {
    var input = document.getElementById('commentInput-' + subId);
    if (!input || !input.value.trim()) return;
    add(subId, input.value.trim());
    render(subId, containerId);
  }
  return { getAll: getAll, get: get, add: add, remove: remove, render: render, submit: submit };
})();

/* ===== 9. Report ===== */
var SubReport = (function() {
  var KEY = 'subtile_reports';
  function getAll() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch(e) { return []; } }
  function report(subId, reason) {
    var list = getAll();
    list.push({ subId: subId, reason: reason, timestamp: Date.now() });
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch(e) {}
  }
  function isReported(subId) {
    return getAll().some(function(r) { return r.subId === subId; });
  }
  function renderButton(subId, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var reported = isReported(subId);
    if (reported) {
      container.innerHTML = '<span style="font-size:0.7rem; color:#ef4444;"><i class="fas fa-flag"></i> Reported</span>';
    } else {
      container.innerHTML = '<button onclick="SubReport.openModal(\'' + escapeAttr(subId) + '\')" style="background:none; border:none; color:#6b7280; cursor:pointer; font-size:0.7rem; padding:0.2rem 0.4rem; transition:color 0.2s;" onmouseenter="this.style.color=\'#ef4444\'" onmouseleave="this.style.color=\'#6b7280\'" title="Report issue"><i class="fas fa-flag"></i></button>';
    }
  }
  function openModal(subId) {
    var reasons = ['Wrong language', 'Desynced / bad timing', 'Poor translation', 'Encoding issues', 'Contains spam', 'Other'];
    var html = '<div style="position:fixed; inset:0; z-index:300; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; padding:1rem;" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#12151b; border:1px solid #23262e; border-radius:16px; padding:1.5rem; max-width:380px; width:100%;">' +
        '<h3 style="font-size:0.95rem; font-weight:700; color:#fff; margin-bottom:1rem;"><i class="fas fa-flag" style="color:#ef4444; margin-right:0.5rem;"></i> Report Subtitle</h3>' +
        reasons.map(function(r) {
          return '<button onclick="SubReport.submit(\'' + escapeAttr(subId) + '\',\'' + r + '\');this.closest(\'div[style*=\"position:fixed\"]\').remove();" style="display:block; width:100%; text-align:left; padding:0.6rem 0.8rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#d1d5db; font-size:0.8rem; cursor:pointer; margin-bottom:0.4rem; transition:all 0.15s;" onmouseenter="this.style.background=\'rgba(239,68,68,0.1)\'" onmouseleave="this.style.background=\'rgba(255,255,255,0.04)\'">' + r + '</button>';
        }).join('') +
        '<button onclick="this.closest(\'div[style*=\"position:fixed\"]\').remove();" style="display:block; width:100%; padding:0.5rem; background:none; border:none; color:#6b7280; font-size:0.8rem; cursor:pointer; margin-top:0.5rem;">Cancel</button>' +
      '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function submit(subId, reason) {
    report(subId, reason);
    if (typeof showToast === 'function') showToast('Report submitted. Thank you!');
  }
  return { getAll: getAll, report: report, isReported: isReported, renderButton: renderButton, openModal: openModal, submit: submit };
})();

/* ===== 10. Share Link ===== */
var ShareLink = (function() {
  function copy(movieId, type) {
    var url = window.location.origin + '/movie.html?id=' + encodeURIComponent(movieId) + '&type=' + encodeURIComponent(type || 'movie');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function() {
        if (typeof showToast === 'function') showToast('Link copied to clipboard!');
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (typeof showToast === 'function') showToast('Link copied!');
    }
  }
  function renderButton(movieId, type, containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<button onclick="ShareLink.copy(\'' + escapeAttr(movieId) + '\',\'' + escapeAttr(type || 'movie') + '\')" style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.5rem 1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.04); color:#9ca3af; cursor:pointer; font-size:0.8rem; font-weight:600; transition:all 0.2s;" onmouseenter="this.style.borderColor=\'rgba(255,255,255,0.25)\';this.style.color=\'#fff\'" onmouseleave="this.style.borderColor=\'rgba(255,255,255,0.1)\';this.style.color=\'#9ca3af\'"><i class="fas fa-share-alt"></i> Share</button>';
  }
  return { copy: copy, renderButton: renderButton };
})();
