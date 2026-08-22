/**
 * Subtile Security & Sanitization Helper
 */
const Security = (() => {
  'use strict';

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"'/]/g, (s) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
      '/': '&#x2F;'
    }[s]));
  }

  function escapeAttribute(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (s) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[s]));
  }

  function sanitizeURL(url, opts = {}) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (opts.allowRelative && (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('assets/'))) {
      return trimmed;
    }
    return '';
  }

  function sanitizeImageURL(url, fallback = 'assets/default-avatar.svg') {
    if (!url || typeof url !== 'string') return fallback;
    const clean = sanitizeURL(url, { allowRelative: true });
    return clean || fallback;
  }

  function isValidUsername(username) {
    if (typeof username !== 'string') return false;
    return /^[a-zA-Z0-9_\u0600-\u06FF]{2,25}$/.test(username.trim());
  }

  function isValidEmail(email) {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  function passwordStrength(password) {
    if (typeof password !== 'string') return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }

  function setText(el, text) {
    if (el) el.textContent = text || '';
  }

  return {
    escapeHTML,
    escapeAttribute,
    sanitizeURL,
    sanitizeImageURL,
    isValidUsername,
    isValidEmail,
    passwordStrength,
    setText
  };
})();

if (typeof window !== 'undefined') {
  window.Security = Security;
}
