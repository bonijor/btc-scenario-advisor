(() => {
  'use strict';

  const PRODUCT = Object.freeze({
    phase: '2B',
    authProvider: 'Firebase Authentication',
    authEnabled: true,
    membershipEnabled: false,
    serverProfileEnabled: false,
    alertsDeliveryEnabled: false,
    preferenceStorageKey: 'btcScenarioPreferencesPreviewV1',
  });

  const $ = (id) => document.getElementById(id);
  const authForms = () => [...document.querySelectorAll('[data-auth-form]')];
  let initialized = false;
  let authAdapter = null;
  let authState = 'idle';
  let authError = null;
  let currentUser = null;
  let activeAuthTab = 'login';

  function syncPhaseCopy() {
    if ($('productPhase')) $('productPhase').textContent = 'FASE 2B';
    const systemIdentity = document.querySelector('#system .lockedFeature');
    if (systemIdentity) {
      const title = systemIdentity.querySelector('b');
      const note = systemIdentity.querySelector('small');
      if (title) title.textContent = '🔐 Cuenta de usuario · Fase 2B';
      if (note) note.textContent = 'Firebase Authentication conectado. Perfil persistente y autorización por membresía permanecen reservados para fases posteriores.';
    }
    const heroNote = document.querySelector('#account .productHero .productNote');
    if (heroNote) heroNote.textContent = 'Firebase Authentication gestiona la identidad sin otorgar acceso de escritura al motor Quant. Perfil persistente, membresías y alertas permanecen separados.';
    const planNote = document.querySelector('#account .membershipCard > p.tiny');
    if (planNote) planNote.textContent = 'Planes en diseño. No existen cobros ni checkout en Fase 2B.';
  }

  function safeLoadPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(PRODUCT.preferenceStorageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function setAuthTab(name) {
    activeAuthTab = name;
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
      const active = button.dataset.authTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    authForms().forEach((form) => {
      const active = form.dataset.authForm === name && !currentUser;
      form.hidden = !active;
      form.setAttribute('aria-hidden', String(!active));
    });
  }

  function ensureAuthControls() {
    const status = $('authFormStatus');
    if (!status || document.getElementById('authFederatedActions')) return;
    status.insertAdjacentHTML('beforebegin', `
      <div class="authFederatedActions" id="authFederatedActions">
        <button class="btn authGoogleButton" id="authGoogleButton" type="button" disabled aria-disabled="true">Continuar con Google</button>
        <button class="btn" id="authLogoutButton" type="button" hidden>Cerrar sesión</button>
      </div>
      <div class="authSession" id="authSession" hidden aria-live="polite"></div>
    `);
  }

  function setAuthControlsReady(ready) {
    document.querySelectorAll('[data-requires-auth]').forEach((control) => {
      control.disabled = !ready || Boolean(currentUser);
      control.setAttribute('aria-disabled', String(control.disabled));
    });
    const googleButton = document.getElementById('authGoogleButton');
    if (googleButton) {
      googleButton.disabled = !ready || Boolean(currentUser);
      googleButton.setAttribute('aria-disabled', String(googleButton.disabled));
    }
  }

  function renderAuthSession() {
    const tabs = document.querySelector('.authTabs');
    const googleButton = document.getElementById('authGoogleButton');
    const logoutButton = document.getElementById('authLogoutButton');
    const session = document.getElementById('authSession');
    const profileTitle = document.querySelector('.profilePreview b');
    const profileNote = document.querySelector('.profilePreview .productNote');

    if (currentUser) {
      if (tabs) tabs.hidden = true;
      authForms().forEach((form) => {
        form.hidden = true;
        form.setAttribute('aria-hidden', 'true');
      });
      if (googleButton) googleButton.hidden = true;
      if (logoutButton) logoutButton.hidden = false;
      if (session) {
        session.hidden = false;
        const identity = currentUser.displayName || currentUser.email || 'Usuario autenticado';
        const verification = currentUser.email
          ? (currentUser.emailVerified ? 'Email verificado' : 'Email pendiente de verificación')
          : 'Cuenta federada';
        session.textContent = `${identity} · ${verification}`;
      }
      if (profileTitle) profileTitle.textContent = currentUser.displayName || 'Perfil autenticado';
      if (profileNote) profileNote.textContent = `${currentUser.email || 'Cuenta Google'} · identidad gestionada por Firebase. Las preferencias continúan locales hasta Fase 2C.`;
      $('profileState').textContent = 'AUTENTICADO';
    } else {
      if (tabs) tabs.hidden = false;
      if (googleButton) googleButton.hidden = false;
      if (logoutButton) logoutButton.hidden = true;
      if (session) session.hidden = true;
      if (profileTitle) profileTitle.textContent = 'Sin sesión';
      if (profileNote) profileNote.textContent = 'Ingresá para asociar una identidad. Las preferencias siguen guardándose sólo en este navegador durante Fase 2B.';
      $('profileState').textContent = 'SIN SESIÓN';
      setAuthTab(activeAuthTab);
    }
  }

  function renderProductState() {
    $('productPhase').textContent = `FASE ${PRODUCT.phase}`;
    $('authProvider').textContent = PRODUCT.authProvider;

    const statusMap = {
      idle: ['CONFIGURADO', 'goodText'],
      loading: ['CONECTANDO', 'warnText'],
      ready: ['ACTIVO', 'goodText'],
      error: ['ERROR', 'badText'],
    };
    const [label, className] = statusMap[authState] || statusMap.error;
    $('authStatus').textContent = label;
    $('authStatus').className = className;
    $('membershipState').textContent = PRODUCT.membershipEnabled ? 'ACTIVO' : 'DISEÑO';
    $('deliveryState').textContent = PRODUCT.alertsDeliveryEnabled ? 'ACTIVO' : 'BLOQUEADO';

    setAuthControlsReady(authState === 'ready');

    if (currentUser) {
      $('authGateMessage').textContent = 'Sesión autenticada por Firebase. La cuenta no obtiene permisos de escritura sobre el motor Quant ni sobre exchanges.';
    } else if (authState === 'ready') {
      $('authGateMessage').textContent = 'Firebase Authentication conectado. El dashboard no persiste contraseñas ni tokens por cuenta propia.';
    } else if (authState === 'error') {
      $('authGateMessage').textContent = 'Autenticación no disponible. El acceso permanece fail-closed y no se simula ninguna sesión.';
    } else {
      $('authGateMessage').textContent = 'Conectando con el proveedor de identidad gestionado…';
    }

    renderAuthSession();
  }

  function loadPreferencesIntoForm() {
    const prefs = {
      horizon5m: true,
      horizon15m: true,
      web: true,
      email: false,
      whatsapp: false,
      minProbability: 72,
      quietHours: false,
      ...safeLoadPreferences(),
    };
    $('pref5m').checked = prefs.horizon5m === true;
    $('pref15m').checked = prefs.horizon15m === true;
    $('prefWeb').checked = prefs.web === true;
    $('prefEmail').checked = prefs.email === true;
    $('prefWhatsapp').checked = prefs.whatsapp === true;
    $('prefProbability').value = String(Math.max(50, Math.min(99, Number(prefs.minProbability) || 72)));
    $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`;
    $('prefQuiet').checked = prefs.quietHours === true;
  }

  function savePreferences(event) {
    event.preventDefault();
    const prefs = {
      horizon5m: $('pref5m').checked,
      horizon15m: $('pref15m').checked,
      web: $('prefWeb').checked,
      email: $('prefEmail').checked,
      whatsapp: $('prefWhatsapp').checked,
      minProbability: Number($('prefProbability').value),
      quietHours: $('prefQuiet').checked,
    };
    localStorage.setItem(PRODUCT.preferenceStorageKey, JSON.stringify(prefs));
    $('preferencesStatus').textContent = 'Preferencias guardadas sólo en este navegador. No modifican el modelo Quant.';
  }

  function authMessage(error) {
    const code = String(error?.code || '');
    const messages = {
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/user-not-found': 'Email o contraseña incorrectos.',
      'auth/wrong-password': 'Email o contraseña incorrectos.',
      'auth/email-already-in-use': 'Ese email ya tiene una cuenta. Probá ingresar.',
      'auth/weak-password': 'La contraseña no cumple la política de seguridad.',
      'auth/invalid-email': 'Ingresá un email válido.',
      'auth/too-many-requests': 'Demasiados intentos. Esperá un momento antes de volver a probar.',
      'auth/network-request-failed': 'No pudimos conectar con Firebase. Revisá la conexión e intentá nuevamente.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Habilitá popups para este sitio.',
      'auth/popup-closed-by-user': 'Inicio con Google cancelado.',
      'auth/cancelled-popup-request': 'Se canceló el intento anterior. Probá nuevamente.',
      'auth/unauthorized-domain': 'Este dominio no está autorizado para iniciar sesión.',
      'auth/operation-not-allowed': 'Este método de ingreso no está habilitado.',
      'auth/account-exists-with-different-credential': 'Ese email ya existe con otro método de ingreso.',
    };
    return messages[code] || 'No pudimos completar el acceso. Intentá nuevamente.';
  }

  function handleAuthState(user, error) {
    currentUser = user || null;
    authError = error || null;
    if (error) authState = 'error';
    renderProductState();
  }

  async function loadAuthAdapter() {
    if (authAdapter || authState === 'loading') return authAdapter;
    authState = 'loading';
    authError = null;
    renderProductState();

    try {
      const testFactory = window.__BTC_AUTH_TEST_ADAPTER_FACTORY__;
      if (typeof testFactory === 'function') {
        authAdapter = await testFactory({ onState: handleAuthState });
      } else {
        const module = await import('./firebase-auth.js');
        authAdapter = await module.createFirebaseAuthAdapter({ onState: handleAuthState });
      }
      authState = 'ready';
      currentUser = authAdapter.getCurrentUser?.() || currentUser;
      renderProductState();
      return authAdapter;
    } catch (error) {
      authState = 'error';
      authError = error;
      $('authFormStatus').textContent = authMessage(error);
      renderProductState();
      return null;
    }
  }

  function setBusy(form, busy) {
    form?.querySelectorAll('button, input').forEach((control) => {
      if (control.type === 'submit') control.disabled = busy;
    });
    form?.setAttribute('aria-busy', String(busy));
  }

  async function submitEmailAuth(event) {
    event.preventDefault();
    if (!authAdapter || authState !== 'ready') return;

    const form = event.currentTarget;
    const mode = form.dataset.authForm;
    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"]');
    const nameInput = form.querySelector('input[autocomplete="name"]');
    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');
    const name = String(nameInput?.value || '').trim();
    if (passwordInput) passwordInput.value = '';

    if (!email || !password) {
      $('authFormStatus').textContent = 'Completá email y contraseña.';
      return;
    }

    setBusy(form, true);
    $('authFormStatus').textContent = mode === 'register' ? 'Creando cuenta…' : 'Ingresando…';
    try {
      if (mode === 'register') {
        await authAdapter.registerEmail({ name, email, password });
        $('authFormStatus').textContent = 'Cuenta creada. Enviamos un email de verificación.';
      } else {
        await authAdapter.signInEmail({ email, password });
        $('authFormStatus').textContent = 'Sesión iniciada correctamente.';
      }
    } catch (error) {
      $('authFormStatus').textContent = authMessage(error);
    } finally {
      setBusy(form, false);
      renderProductState();
    }
  }

  async function signInGoogle() {
    if (!authAdapter || authState !== 'ready') return;
    const button = document.getElementById('authGoogleButton');
    if (button) button.disabled = true;
    $('authFormStatus').textContent = 'Abriendo Google…';
    try {
      await authAdapter.signInGoogle();
      $('authFormStatus').textContent = 'Sesión iniciada con Google.';
    } catch (error) {
      $('authFormStatus').textContent = authMessage(error);
    } finally {
      if (button && !currentUser) button.disabled = false;
      renderProductState();
    }
  }

  async function signOutAccount() {
    if (!authAdapter || authState !== 'ready') return;
    const button = document.getElementById('authLogoutButton');
    if (button) button.disabled = true;
    try {
      await authAdapter.signOut();
      $('authFormStatus').textContent = 'Sesión cerrada.';
    } catch (error) {
      $('authFormStatus').textContent = authMessage(error);
    } finally {
      if (button) button.disabled = false;
      renderProductState();
    }
  }

  function initAccount() {
    if (initialized) return;
    initialized = true;
    ensureAuthControls();
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
      button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
    });
    authForms().forEach((form) => {
      form.addEventListener('submit', submitEmailAuth);
      form.querySelectorAll('input').forEach((input) => { input.required = true; });
    });
    $('preferencesForm')?.addEventListener('submit', savePreferences);
    $('prefProbability')?.addEventListener('input', () => {
      $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`;
    });
    document.getElementById('authGoogleButton')?.addEventListener('click', signInGoogle);
    document.getElementById('authLogoutButton')?.addEventListener('click', signOutAccount);
    setAuthTab('login');
    renderProductState();
    loadPreferencesIntoForm();
    void loadAuthAdapter();
  }

  function boot() {
    syncPhaseCopy();
    document.querySelectorAll('[data-view="account"]').forEach((button) => {
      button.addEventListener('click', initAccount, { once: true });
    });
    if ($('account')?.classList.contains('active')) initAccount();
  }

  window.BTC_PRODUCT = PRODUCT;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
