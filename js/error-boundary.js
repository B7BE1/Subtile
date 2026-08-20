/**
 * Error Boundary for vanilla JS
 * Catches unhandled errors and shows friendly UI instead of breaking the page
 */
(function () {
  'use strict';

  const ERROR_KEY = 'subtile_error_log';
  const MAX_LOG = 20;

  function logError(error, source) {
    try {
      const log = JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
      log.unshift({
        message: error.message || String(error),
        source: source || 'unknown',
        stack: error.stack || '',
        time: new Date().toISOString(),
      });
      if (log.length > MAX_LOG) log.length = MAX_LOG;
      localStorage.setItem(ERROR_KEY, JSON.stringify(log));
    } catch {}
  }

  function showErrorUI(message) {
    if (document.getElementById('errorBoundary')) return;
    const el = document.createElement('div');
    el.id = 'errorBoundary';
    el.style.cssText =
      'position:fixed;inset:0;z-index:9999;background:#0a0a0c;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;';
    el.innerHTML = `
      <div style="text-align:center;max-width:480px;padding:2rem;">
        <div style="font-size:4rem;margin-bottom:1rem;opacity:0.5;">⚠️</div>
        <h2 style="color:#fff;font-size:1.5rem;margin-bottom:0.5rem;">Something went wrong</h2>
        <p style="color:#6b7280;font-size:0.9rem;margin-bottom:1.5rem;">${escapeText(message)}</p>
        <button onclick="location.reload()" style="background:#fff;color:#0a0a0c;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.9rem;">
          <i class="fas fa-redo" style="margin-right:0.4rem;"></i> Reload Page
        </button>
        <button onclick="this.closest('#errorBoundary').remove()" style="background:rgba(255,255,255,0.06);color:#9ca3af;border:1px solid rgba(255,255,255,0.1);padding:0.6rem 1.5rem;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.9rem;margin-left:0.5rem;">
          Dismiss
        </button>
      </div>`;
    document.body.appendChild(el);
  }

  function escapeText(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  window.addEventListener('error', (e) => {
    logError(e.error || new Error(e.message), e.filename);
    if (e.filename && (e.filename.includes('cdn.tailwindcss') || e.filename.includes('cdnjs.cloudflare'))) return;
    if (document.querySelector('.split-container.loaded') || document.getElementById('catalogGrid')) return;
    showErrorUI(e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || String(e.reason);
    logError({ message: msg, stack: '' }, 'unhandledrejection');
    if (msg.includes('AbortError') || msg.includes('abort')) return;
    console.warn('[ErrorBoundary] Unhandled rejection:', msg);
  });

  window.getErrorLog = function () {
    try {
      return JSON.parse(localStorage.getItem(ERROR_KEY) || '[]');
    } catch {
      return [];
    }
  };

  window.clearErrorLog = function () {
    try {
      localStorage.removeItem(ERROR_KEY);
    } catch {}
  };
})();
