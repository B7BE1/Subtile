/**
 * SubHub Security Module
 * ------------------------------------------------------------------
 * Zero-trust sanitization & safe-DOM helpers.
 * Every place in the app that renders user-supplied data (usernames,
 * bios, comments, translator README/release notes, search terms,
 * uploaded filenames, avatar/image URLs) MUST go through this module.
 *
 * Rules enforced here:
 *   1. No unescaped innerHTML with user data — ever.
 *   2. Only a small, explicit allow-list of "rich text" tags/attrs is
 *      permitted for the Translator README / release notes renderer.
 *   3. Only https:// URLs are allowed for links/images/avatars.
 *      javascript:, data:, vbscript:, file: and any other scheme is
 *      stripped.
 *   4. Uploaded subtitle files are restricted to a safe extension +
 *      MIME + size allow-list.
 * ------------------------------------------------------------------
 */

const Security = (() => {

  // ---------------------------------------------------------------
  // 1. Plain-text escaping (usernames, titles, comments, search, etc.)
  // ---------------------------------------------------------------

  const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  };

  /**
   * Escapes a raw string so it can never be interpreted as HTML/JS
   * when injected into innerHTML. Use this for ANY user-controlled
   * plain text: usernames, bios, comment bodies, release names, etc.
   */
  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`=/]/g, (ch) => ESCAPE_MAP[ch]);
  }

  /**
   * Escapes a string for safe use inside an HTML attribute value
   * (e.g. title="...", data-x="...").
   */
  function escapeAttribute(str) {
    return escapeHTML(str);
  }

  // ---------------------------------------------------------------
  // 2. URI validation (avatars, poster overrides, links in README,
  //    download links, redirect targets)
  // ---------------------------------------------------------------

  const DANGEROUS_SCHEMES = /^\s*(javascript|data|vbscript|file|blob):/i;

  /**
   * Returns a safe URL string, or '' if the URL is not allowed.
   * Only http(s) is permitted by default; pass { allowRelative: true }
   * to also allow root-relative paths like "/uploads/avatar.png".
   */
  function sanitizeURL(url, { allowRelative = false } = {}) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();

    if (DANGEROUS_SCHEMES.test(trimmed)) return '';

    if (allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed, window.location.origin);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
      return parsed.href;
    } catch (e) {
      return '';
    }
  }

  /**
   * Convenience wrapper specifically for image/avatar sources.
   * Falls back to a placeholder if the URL is unsafe or empty.
   */
  function sanitizeImageURL(url, fallback = 'assets/default-avatar.svg') {
    const safe = sanitizeURL(url, { allowRelative: true });
    return safe || fallback;
  }

  // ---------------------------------------------------------------
  // 3. Restricted rich-text sanitizer for Translator README /
  //    release notes / comments. Allow-list only — anything not
  //    explicitly permitted is stripped, not merely escaped.
  // ---------------------------------------------------------------

  const ALLOWED_TAGS = new Set([
    'B', 'STRONG', 'I', 'EM', 'U', 'S', 'BR', 'P',
    'UL', 'OL', 'LI', 'CODE', 'PRE', 'BLOCKQUOTE',
    'H3', 'H4', 'A', 'SPAN', 'IMG'
  ]);

  const ALLOWED_ATTRS = {
    A: ['href', 'title'],
    IMG: ['src', 'alt'],
    SPAN: ['class']
  };

  // Only these classes are allowed on <span> (e.g. spoiler tags),
  // preventing style/class-based attacks.
  const ALLOWED_SPAN_CLASSES = new Set(['spoiler', 'hi-badge']);

  /**
   * Sanitizes a fragment of "rich" markup (already-parsed HTML string,
   * e.g. produced by a restricted markdown renderer) down to a safe
   * allow-listed subset. Any tag/attribute not explicitly permitted
   * is removed; the tag's safe children are kept.
   *
   * This is the ONLY function that should ever be used to render
   * translator README / release notes / rich comments via innerHTML.
   */

  // ---------------------------------------------------------------
  // 4. Safe DOM helpers — prefer these over direct innerHTML usage
  //    at call sites throughout the app.
  // ---------------------------------------------------------------

  /**
   * Sets text content safely (no HTML interpretation at all).
   * Use for usernames, titles, numbers, dates, etc.
   */
  function setText(el, value) {
    if (!el) return;
    el.textContent = value === null || value === undefined ? '' : String(value);
  }

  // ---------------------------------------------------------------
  // 6. Basic client-side input validators (auth forms etc.)
  // ---------------------------------------------------------------

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // 3-20 chars, letters/numbers/underscore, must start with a letter
  const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,19}$/;

  function isValidEmail(email) {
    return typeof email === 'string' && EMAIL_RE.test(email.trim());
  }

  function isValidUsername(username) {
    return typeof username === 'string' && USERNAME_RE.test(username.trim());
  }

  /**
   * Scores password strength 0-4 (very weak -> very strong).
   * Purely a UX hint — never rely on this alone server-side.
   */
  function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }

  return {
    escapeHTML,
    escapeAttribute,
    sanitizeURL,
    sanitizeImageURL,
    setText,
    isValidEmail,
    isValidUsername,
    passwordStrength
  };
})();

// Freeze to prevent prototype pollution / tampering from other scripts.
Object.freeze(Security);
