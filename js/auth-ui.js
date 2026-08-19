/**
 * SubHub Auth UI
 * ------------------------------------------------------------------
 * Wires the Auth + Security modules to the DOM: the login/register/
 * forgot-password modal, its tab switcher & live validation, and the
 * navbar's guest-buttons <-> user-avatar-menu swap.
 *
 * Depends on: js/security.js, js/auth.js (load both before this file).
 * Expects the auth modal markup (id="authModal") and the
 * #navAuthSlot container to exist in the page (see index.html /
 * movie.html / profile.html).
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  function $(sel, root = document) { return root.querySelector(sel); }
  function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  // ---------------------------------------------------------------
  // Modal open/close + tab switching
  // ---------------------------------------------------------------

  function openAuthModal(tab = 'login') {
    const modal = $('#authModal');
    if (!modal) return;
    modal.classList.add('show');
    switchAuthTab(tab);
  }

  function closeAuthModal() {
    const modal = $('#authModal');
    if (!modal) return;
    modal.classList.remove('show');
    clearAuthErrors();
  }

  function switchAuthTab(tab) {
    const tabs = $all('.auth-tab');
    const panels = $all('.auth-panel');
    const indicator = $('.auth-tab-indicator');

    tabs.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab));

    if (indicator) {
      const order = ['login', 'register', 'forgot'];
      const idx = order.indexOf(tab);
      if (idx !== -1) {
        const isRTL = document.documentElement.dir === 'rtl';
        const offset = idx * (isRTL ? -100 : 100);
        indicator.style.transform = `translateX(${offset}%)`;
      }
    }
    clearAuthErrors();
  }

  function clearAuthErrors() {
    $all('.form-error').forEach((el) => { el.classList.remove('show'); el.textContent = ''; });
    $all('.form-control').forEach((el) => el.classList.remove('is-invalid', 'is-valid'));
  }

  function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + 'Error');
    if (input) input.classList.add('is-invalid');
    if (err) { err.textContent = message; err.classList.add('show'); }
  }

  function markValid(inputId) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + 'Error');
    if (input) { input.classList.remove('is-invalid'); input.classList.add('is-valid'); }
    if (err) { err.textContent = ''; err.classList.remove('show'); }
  }

  // ---------------------------------------------------------------
  // Live validation
  // ---------------------------------------------------------------

  function wireLiveValidation() {
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');

    if (regUsername) {
      regUsername.addEventListener('input', () => {
        const val = regUsername.value.trim();
        if (!val) return clearFieldState('regUsername');
        Security.isValidUsername(val)
          ? markValid('regUsername')
          : showFieldError('regUsername', 'اسم المستخدم: 3-20 حرفًا، يبدأ بحرف، أحرف/أرقام/شرطة سفلية فقط.');
      });
    }

    if (regEmail) {
      regEmail.addEventListener('input', () => {
        const val = regEmail.value.trim();
        if (!val) return clearFieldState('regEmail');
        Security.isValidEmail(val)
          ? markValid('regEmail')
          : showFieldError('regEmail', 'صيغة البريد الإلكتروني غير صحيحة.');
      });
    }

    if (regPassword) {
      regPassword.addEventListener('input', () => {
        const strength = Security.passwordStrength(regPassword.value);
        renderPasswordStrength(strength);
        if (!regPassword.value) return clearFieldState('regPassword');
        strength >= 2
          ? markValid('regPassword')
          : showFieldError('regPassword', 'كلمة مرور أقوى مطلوبة (8+ أحرف، أرقام وحروف).');
      });
    }
  }

  function clearFieldState(inputId) {
    const input = document.getElementById(inputId);
    const err = document.getElementById(inputId + 'Error');
    if (input) input.classList.remove('is-invalid', 'is-valid');
    if (err) { err.textContent = ''; err.classList.remove('show'); }
  }

  function renderPasswordStrength(score) {
    const bars = $all('.password-strength-bar');
    if (!bars.length) return;
    const labels = ['weak', 'weak', 'medium', 'strong', 'strong'];
    bars.forEach((bar, i) => {
      bar.classList.remove('weak', 'medium', 'strong');
      if (i < score) bar.classList.add(labels[score] || 'weak');
    });
  }

  // ---------------------------------------------------------------
  // Form submit handlers
  // ---------------------------------------------------------------

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const identifier = $('#loginIdentifier').value;
    const password = $('#loginPassword').value;
    const submitBtn = $('#loginSubmitBtn');

    clearAuthErrors();
    setBtnLoading(submitBtn, true);

    try {
      await Auth.login({ identifier, password });
      closeAuthModal();
      showToast('تم تسجيل الدخول بنجاح! أهلاً بعودتك 👋');
      event.target.reset();
    } catch (e) {
      if (e instanceof Auth.AuthError) {
        showFieldError('loginPassword', e.message);
      } else {
        showToast('حدث خطأ غير متوقع، حاول مرة أخرى.', 'error');
        console.error(e);
      }
    } finally {
      setBtnLoading(submitBtn, false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    const username = $('#regUsername').value;
    const email = $('#regEmail').value;
    const password = $('#regPassword').value;
    const confirm = $('#regPasswordConfirm').value;
    const submitBtn = $('#registerSubmitBtn');

    clearAuthErrors();

    if (password !== confirm) {
      showFieldError('regPasswordConfirm', 'كلمتا المرور غير متطابقتين.');
      return;
    }

    setBtnLoading(submitBtn, true);
    try {
      await Auth.register({ username, email, password });
      closeAuthModal();
      showToast(`مرحبًا بك في SubHub، ${username}! تم إنشاء حسابك بنجاح 🎬`);
      event.target.reset();
    } catch (e) {
      if (e instanceof Auth.AuthError) {
        if (/اسم المستخدم/.test(e.message)) showFieldError('regUsername', e.message);
        else if (/البريد/.test(e.message)) showFieldError('regEmail', e.message);
        else if (/كلمة المرور/.test(e.message)) showFieldError('regPassword', e.message);
        else showToast(e.message, 'error');
      } else {
        showToast('حدث خطأ غير متوقع، حاول مرة أخرى.', 'error');
        console.error(e);
      }
    } finally {
      setBtnLoading(submitBtn, false);
    }
  }

  async function handleForgotSubmit(event) {
    event.preventDefault();
    const email = $('#forgotEmail').value;
    const submitBtn = $('#forgotSubmitBtn');

    clearAuthErrors();
    setBtnLoading(submitBtn, true);
    try {
      await Auth.requestPasswordReset({ email });
      showToast('إذا كان البريد مسجلاً لدينا، ستصلك رسالة لإعادة تعيين كلمة المرور.', 'info');
      event.target.reset();
      switchAuthTab('login');
    } catch (e) {
      if (e instanceof Auth.AuthError) showFieldError('forgotEmail', e.message);
      else showToast('حدث خطأ غير متوقع.', 'error');
    } finally {
      setBtnLoading(submitBtn, false);
    }
  }

  function setBtnLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
    btn.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> جارٍ التحميل...'
      : btn.dataset.originalText;
  }

  // ---------------------------------------------------------------
  // Navbar: guest actions <-> user menu
  // ---------------------------------------------------------------

  function renderNavAuthSlot(user) {
    const slot = document.getElementById('navAuthSlot');
    if (!slot) return;
    slot.innerHTML = '';

    if (!user) {
      const loginBtn = document.createElement('button');
      loginBtn.className = 'btn btn-secondary';
      loginBtn.innerHTML = '<i class="fas fa-user"></i>';
      const loginText = document.createElement('span');
      Security.setText(loginText, ' تسجيل الدخول');
      loginBtn.appendChild(loginText);
      loginBtn.addEventListener('click', () => openAuthModal('login'));
      slot.appendChild(loginBtn);
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'user-menu';

    const trigger = document.createElement('button');
    trigger.className = 'user-menu-trigger';
    trigger.setAttribute('aria-haspopup', 'true');

    const DEFAULT_AVATAR = 'assets/default-avatar.svg';
    const avatarImg = document.createElement('img');
    avatarImg.className = 'avatar avatar-sm';
    avatarImg.src = Security.sanitizeImageURL(user.avatar, DEFAULT_AVATAR);
    avatarImg.alt = '';
    avatarImg.onerror = function () {
      this.onerror = null; // prevent infinite loop if the fallback itself fails to load
      this.src = DEFAULT_AVATAR;
    };

    const nameSpan = document.createElement('span');
    nameSpan.className = 'user-menu-name';
    Security.setText(nameSpan, user.username);

    trigger.appendChild(avatarImg);
    trigger.appendChild(nameSpan);
    trigger.appendChild(Object.assign(document.createElement('i'), { className: 'fas fa-chevron-down', style: 'font-size:0.7rem' }));

    const dropdown = document.createElement('div');
    dropdown.className = 'user-menu-dropdown';

    const profileLink = document.createElement('a');
    profileLink.className = 'user-menu-item';
    profileLink.href = `profile.html?user=${encodeURIComponent(user.username)}`;
    profileLink.innerHTML = '<i class="fas fa-user-circle"></i> ';
    const profileText = document.createElement('span');
    Security.setText(profileText, 'Profile');
    profileLink.appendChild(profileText);

    const uploadItem = document.createElement('button');
    uploadItem.className = 'user-menu-item';
    uploadItem.innerHTML = '<i class="fas fa-upload"></i> ';
    const uploadText = document.createElement('span');
    Security.setText(uploadText, 'Upload Subtitle');
    uploadItem.appendChild(uploadText);
    uploadItem.addEventListener('click', () => {
      dropdown.classList.remove('show');
      if (typeof openUploadModal === 'function') openUploadModal();
    });

    const divider = document.createElement('div');
    divider.className = 'user-menu-divider';

    const logoutItem = document.createElement('button');
    logoutItem.className = 'user-menu-item danger';
    logoutItem.innerHTML = '<i class="fas fa-sign-out-alt"></i> ';
    const logoutText = document.createElement('span');
    Security.setText(logoutText, 'Logout');
    logoutItem.appendChild(logoutText);
    logoutItem.addEventListener('click', () => {
      Auth.logout();
      dropdown.classList.remove('show');
      showToast('Logged out successfully.');
    });

    dropdown.appendChild(profileLink);
    dropdown.appendChild(uploadItem);
    dropdown.appendChild(divider);
    dropdown.appendChild(logoutItem);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'));

    menu.appendChild(trigger);
    menu.appendChild(dropdown);
    slot.appendChild(menu);
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------

  function init() {
    if (typeof Security === 'undefined' || typeof Auth === 'undefined') {
      console.error('SubHub Auth UI: security.js and auth.js must be loaded first.');
      return;
    }

    $all('[data-auth-tab-trigger]').forEach((btn) => {
      btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTabTrigger));
    });

    $all('.auth-tab').forEach((btn) => {
      btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
    });

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotForm = document.getElementById('forgotForm');
    if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
    if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
    if (forgotForm) forgotForm.addEventListener('submit', handleForgotSubmit);

    wireLiveValidation();

    Auth.onChange(renderNavAuthSlot);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose the small set of functions the inline HTML onclick handlers need.
  window.openAuthModal = openAuthModal;
  window.closeAuthModal = closeAuthModal;
  window.switchAuthTab = switchAuthTab;
})();
