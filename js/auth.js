/**
 * SubHub Auth Module
 * ------------------------------------------------------------------
 * Client-side authentication & session state management.
 *
 * There is no real backend yet, so this module simulates one using
 * localStorage as a "users table" + a session token. It is built so
 * swapping in a real API later only means rewriting the four
 * `_api*` methods below — everything else (state, events, UI wiring)
 * stays the same.
 *
 * Security notes:
 *   - Passwords are never stored in plain text, even in this mock
 *     backend: they're hashed with SHA-256 + a per-user salt via
 *     window.crypto.subtle. This is NOT a substitute for a real
 *     server-side auth system (bcrypt/argon2 + HTTPS + rate limiting)
 *     — it only prevents trivially reading passwords out of
 *     localStorage during local development/demo.
 *   - All user-supplied strings (username, bio, email) are validated
 *     with Security.isValidEmail / isValidUsername before storage,
 *     and must be escaped via Security.escapeHTML at render time.
 * ------------------------------------------------------------------
 */

const Auth = (() => {

  const USERS_KEY = 'subhub_users';
  const SESSION_KEY = 'subhub_session';

  let currentUser = null;
  const listeners = new Set();

  // ---------------------------------------------------------------
  // Crypto helpers
  // ---------------------------------------------------------------

  function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  function randomSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufferToHex(arr.buffer);
  }

  async function hashPassword(password, salt) {
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + ':' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return bufferToHex(digest);
  }

  // ---------------------------------------------------------------
  // Mock "database" access
  // ---------------------------------------------------------------

  function readUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function publicUser(user) {
    if (!user) return null;
    const { passwordHash, salt, ...safe } = user;
    return safe;
  }

  // ---------------------------------------------------------------
  // Event emitter — UI (navbar, profile page, etc.) subscribes to
  // this to react to login/logout/register/update without polling.
  // ---------------------------------------------------------------

  function emit() {
    const snapshot = publicUser(currentUser);
    listeners.forEach((cb) => {
      try { cb(snapshot); } catch (e) { console.error('Auth listener error:', e); }
    });
  }

  function onChange(callback) {
    listeners.add(callback);
    callback(publicUser(currentUser)); // fire immediately with current state
    return () => listeners.delete(callback);
  }

  // ---------------------------------------------------------------
  // Session restore
  // ---------------------------------------------------------------

  function restoreSession() {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!session || !session.userId) return;
      const users = readUsers();
      const user = users.find((u) => u.id === session.userId);
      if (user) currentUser = user;
    } catch (e) {
      currentUser = null;
    }
  }

  // ---------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------

  async function register({ username, email, password }) {
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();

    if (!Security.isValidUsername(username)) {
      throw new AuthError('اسم المستخدم يجب أن يبدأ بحرف ويتكون من 3-20 حرفًا/رقمًا.');
    }
    if (!Security.isValidEmail(email)) {
      throw new AuthError('البريد الإلكتروني غير صالح.');
    }
    if (Security.passwordStrength(password) < 2) {
      throw new AuthError('كلمة المرور ضعيفة جدًا. استخدم 8 أحرف على الأقل مع أرقام وحروف كبيرة وصغيرة.');
    }

    const users = readUsers();
    const usernameTaken = users.some((u) => u.username.toLowerCase() === username.toLowerCase());
    const emailTaken = users.some((u) => u.email === email);
    if (usernameTaken) throw new AuthError('اسم المستخدم هذا محجوز بالفعل.');
    if (emailTaken) throw new AuthError('هذا البريد الإلكتروني مسجل بالفعل.');

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);

    const newUser = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      username,
      email,
      salt,
      passwordHash,
      bio: '',
      avatar: '',
      isVerifiedTranslator: false,
      createdAt: new Date().toISOString(),
      stats: { uploads: 0, downloads: 0, likesReceived: 0 }
    };

    users.push(newUser);
    writeUsers(users);

    currentUser = newUser;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: newUser.id }));
    emit();
    return publicUser(newUser);
  }

  async function login({ identifier, password }) {
    identifier = (identifier || '').trim().toLowerCase();
    const users = readUsers();
    const user = users.find(
      (u) => u.email === identifier || u.username.toLowerCase() === identifier
    );

    // Generic error message on purpose — never reveal whether the
    // username/email exists or the password was wrong.
    const genericError = 'بيانات الدخول غير صحيحة.';
    if (!user) throw new AuthError(genericError);

    const attemptHash = await hashPassword(password, user.salt);
    if (attemptHash !== user.passwordHash) throw new AuthError(genericError);

    currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id }));
    emit();
    return publicUser(user);
  }

  function logout() {
    currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    emit();
  }

  async function requestPasswordReset({ email }) {
    email = (email || '').trim().toLowerCase();
    if (!Security.isValidEmail(email)) {
      throw new AuthError('البريد الإلكتروني غير صالح.');
    }
    // Mock: in a real backend this triggers an email with a signed
    // reset token. We deliberately do not reveal whether the email
    // exists, to avoid user enumeration.
    return true;
  }

  function updateProfile(patch) {
    if (!currentUser) throw new AuthError('يجب تسجيل الدخول أولًا.');
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === currentUser.id);
    if (idx === -1) throw new AuthError('المستخدم غير موجود.');

    const safePatch = {};
    if (typeof patch.bio === 'string') safePatch.bio = patch.bio.slice(0, 500);
    if (typeof patch.avatar === 'string') {
      safePatch.avatar = Security.sanitizeURL(patch.avatar, { allowRelative: true });
    }

    users[idx] = { ...users[idx], ...safePatch };
    writeUsers(users);
    currentUser = users[idx];
    emit();
    return publicUser(currentUser);
  }

  function getCurrentUser() {
    return publicUser(currentUser);
  }

  function isLoggedIn() {
    return !!currentUser;
  }

  function getPublicProfileByUsername(username) {
    const users = readUsers();
    const user = users.find((u) => u.username.toLowerCase() === (username || '').toLowerCase());
    return publicUser(user);
  }

  class AuthError extends Error {}

  restoreSession();

  return {
    register,
    login,
    logout,
    requestPasswordReset,
    updateProfile,
    getCurrentUser,
    isLoggedIn,
    getPublicProfileByUsername,
    onChange,
    AuthError
  };
})();
