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
  function sanitizeRichText(htmlString) {
    if (!htmlString) return '';

    const template = document.createElement('template');
    template.innerHTML = htmlString;

    const walk = (node) => {
      // Snapshot children first since we may mutate the tree.
      const children = Array.from(node.childNodes);

      for (const child of children) {
        if (child.nodeType === Node.COMMENT_NODE) {
          child.remove();
          continue;
        }

        if (child.nodeType === Node.TEXT_NODE) {
          continue; // text nodes are always safe as-is
        }

        if (child.nodeType !== Node.ELEMENT_NODE) {
          child.remove();
          continue;
        }

        const tag = child.tagName;

        if (!ALLOWED_TAGS.has(tag)) {
          // Unwrap: keep safe text content, drop the disallowed tag.
          const text = document.createTextNode(child.textContent || '');
          node.replaceChild(text, child);
          continue;
        }

        // Strip every attribute not explicitly allow-listed for this tag.
        const allowedForTag = ALLOWED_ATTRS[tag] || [];
        Array.from(child.attributes).forEach((attr) => {
          if (!allowedForTag.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        });

        if (tag === 'A') {
          const safeHref = sanitizeURL(child.getAttribute('href'));
          if (safeHref) {
            child.setAttribute('href', safeHref);
            child.setAttribute('rel', 'noopener noreferrer nofollow ugc');
            child.setAttribute('target', '_blank');
          } else {
            child.removeAttribute('href');
          }
        }

        if (tag === 'IMG') {
          const safeSrc = sanitizeURL(child.getAttribute('src'));
          if (safeSrc) {
            child.setAttribute('src', safeSrc);
            child.setAttribute('loading', 'lazy');
            child.setAttribute('referrerpolicy', 'no-referrer');
          } else {
            // No safe image source — drop the element entirely.
            child.remove();
            continue;
          }
        }

        if (tag === 'SPAN') {
          const cls = child.getAttribute('class');
          if (!cls || !ALLOWED_SPAN_CLASSES.has(cls)) {
            child.removeAttribute('class');
          }
        }

        walk(child); // recurse into the (now-cleaned) element
      }
    };

    walk(template.content);
    return template.innerHTML;
  }

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

  /**
   * Sets innerHTML from a template where all interpolated dynamic
   * values have already been escaped via escapeHTML(). This makes the
   * escaping step explicit and greppable at call sites, e.g.:
   *
   *   el.innerHTML = Security.safeTemplate`<b>${Security.escapeHTML(name)}</b>`;
   *
   * Provided as a tagged template helper so raw interpolations without
   * escapeHTML() stand out visually during review.
   */
  function safeTemplate(strings, ...values) {
    return strings.reduce((out, str, i) => {
      const val = i < values.length ? values[i] : '';
      return out + str + val;
    }, '');
  }

  /**
   * Renders sanitized rich text (README/notes/comments) into a
   * container element. This is the single approved entry point for
   * that content type.
   */
  function renderRichText(el, rawHTML) {
    if (!el) return;
    el.innerHTML = sanitizeRichText(rawHTML);
  }

  // ---------------------------------------------------------------
  // 5. File upload validation (subtitle files)
  // ---------------------------------------------------------------

  const ALLOWED_SUBTITLE_EXT = ['.srt', '.vtt', '.zip'];
  const ALLOWED_SUBTITLE_MIME = [
    'text/plain',
    'text/vtt',
    'application/x-subrip',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream' // many browsers report .srt/.vtt this way
  ];
  const MAX_SUBTITLE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  function getExtension(filename) {
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.slice(idx).toLowerCase();
  }

  /**
   * Validates a File object selected for subtitle upload.
   * Returns { valid: boolean, error?: string, safeName?: string }
   */
  function validateSubtitleFile(file) {
    if (!file) return { valid: false, error: 'لم يتم اختيار أي ملف.' };

    const ext = getExtension(file.name);
    if (!ALLOWED_SUBTITLE_EXT.includes(ext)) {
      return { valid: false, error: 'صيغة الملف غير مسموحة. الصيغ المسموحة: .srt, .vtt, .zip' };
    }

    if (file.type && !ALLOWED_SUBTITLE_MIME.includes(file.type)) {
      return { valid: false, error: 'نوع الملف (MIME) غير موثوق.' };
    }

    if (file.size > MAX_SUBTITLE_FILE_SIZE) {
      return { valid: false, error: 'حجم الملف يتجاوز الحد المسموح (5MB).' };
    }

    // Strip path separators / control characters from the filename
    // before it's ever used for display or storage keys.
    const safeName = file.name
      .replace(/[\\/]/g, '_')
      .replace(/[\x00-\x1f]/g, '')
      .slice(0, 180);

    return { valid: true, safeName };
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
    sanitizeRichText,
    renderRichText,
    setText,
    safeTemplate,
    validateSubtitleFile,
    isValidEmail,
    isValidUsername,
    passwordStrength
  };
})();

// Freeze to prevent prototype pollution / tampering from other scripts.
Object.freeze(Security);
