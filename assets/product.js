(() => {
  'use strict';

  const PRODUCT = Object.freeze({
    phase: '2B',
    uxRevision: '2C',
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
  let paperObserver = null;

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function syncNavigationCopy() {
    const desktop = {
      overview: '▦ Resumen', analytics: '⌁ Análisis', paper: '◎ Simulaciones',
      trial: '◷ Prueba 90D', system: '⚙ Sistema', account: '◉ Cuenta',
    };
    const mobile = {
      overview: 'Inicio', analytics: 'Análisis', paper: 'Simul.',
      trial: '90D', system: 'Sistema', account: 'Cuenta',
    };
    document.querySelectorAll('.nav [data-view]').forEach((button) => {
      if (desktop[button.dataset.view]) button.textContent = desktop[button.dataset.view];
    });
    document.querySelectorAll('.mobileNav [data-view]').forEach((button) => {
      if (mobile[button.dataset.view]) button.textContent = mobile[button.dataset.view];
    });
  }

  function syncInformationCopy() {
    setText('.topbar .ey', 'Análisis probabilístico · BTC/USDT');
    setText('.topbar .tiny', 'Solo lectura · prueba 90 días · sin órdenes reales');
    const statusLabels = ['Datos', 'API', 'Prueba 90D', 'Mercado'];
    document.querySelectorAll('.statusStrip .statusCell > span').forEach((label, index) => {
      if (statusLabels[index]) label.textContent = statusLabels[index];
    });
    const candleLabels = ['Apertura', 'Máximo', 'Mínimo', 'Cierre'];
    document.querySelectorAll('.chartFooter .chartStat > span').forEach((label, index) => {
      if (candleLabels[index]) label.textContent = candleLabels[index];
    });
    setText('#paper .ey', 'Simulaciones');
    setText('#paper h2', 'Operaciones simuladas verificadas');
    setText('#paper > .content > p.tiny', 'Sólo se publica una simulación cuando existen entrada, salida, costos y evidencia. Una señal bloqueada o una abstención no cuenta como operación.');
    setText('#analytics .ey', 'Calidad y calibración');
    setText('#analytics h2', 'Análisis del modelo · 5m / 15m');
    const analyticsIntro = document.querySelector('#analytics .content > p.tiny');
    if (analyticsIntro) analyticsIntro.textContent = 'Métricas oficiales servidas por la API de solo lectura. BA mide acierto balanceado; BSS compara contra una referencia; ECE mide error de calibración y cuanto menor, mejor.';
  }

  function syncPhaseCopy() {
    if ($('productPhase')) $('productPhase').textContent = 'FASE 2B';
    const systemIdentity = document.querySelector('#system .lockedFeature');
    if (systemIdentity) {
      const title = systemIdentity.querySelector('b');
      const note = systemIdentity.querySelector('small');
      if (title) title.textContent = '🔐 Cuenta de usuario · activa';
      if (note) note.textContent = 'Firebase Authentication conectado. Perfil persistente y autorización por membresía permanecen reservados para fases posteriores.';
    }
    const heroNote = document.querySelector('#account .productHero .productNote');
    if (heroNote) heroNote.textContent = 'Tu identidad se gestiona de forma separada del motor Quant. Una cuenta nunca obtiene permisos para modificar el modelo ni ejecutar operaciones.';
    const planNote = document.querySelector('#account .membershipCard > p.tiny');
    if (planNote) planNote.textContent = 'Planes en diseño. No existen cobros ni checkout en esta fase.';
    syncNavigationCopy();
    syncInformationCopy();
  }

  function ensurePaperEmptyState() {
    const body = $('tradesBody');
    const wrap = body?.closest('.tableWrap');
    if (!body || !wrap) return;
    let empty = document.getElementById('paperEmptyState');
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'paperEmptyState';
      empty.className = 'emptyState';
      empty.innerHTML = '<div class="emptyStateIcon" aria-hidden="true">◎</div><h3>Aún no hay simulaciones verificadas</h3><p>Cuando el motor complete una entrada y salida simuladas con costos y evidencia, la operación aparecerá aquí automáticamente.</p><small>Las abstenciones y señales bloqueadas siguen siendo decisiones, no trades.</small>';
      wrap.insertAdjacentElement('beforebegin', empty);
    }
    const sync = () => {
      const isEmpty = /Sin trades simulados verificados/i.test(body.textContent || '');
      empty.hidden = !isEmpty;
      wrap.hidden = isEmpty;
    };
    sync();
    paperObserver?.disconnect();
    paperObserver = new MutationObserver(sync);
    paperObserver.observe(body, { childList: true, subtree: true, characterData: true });
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
    const status = $('authFormStatus');
    if (status && !currentUser) status.textContent = '';
  }

  function decoratePasswordFields() {
    authForms().forEach((form) => {
      const input = form.querySelector('input[type="password"]');
      if (!input || input.parentElement?.querySelector('.passwordToggle')) return;
      input.parentElement?.classList.add('passwordField');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'passwordToggle';
      button.textContent = 'Mostrar';
      button.setAttribute('aria-label', 'Mostrar contraseña');
      button.addEventListener('click', () => {
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.textContent = reveal ? 'Ocultar' : 'Mostrar';
        button.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
      });
      input.insertAdjacentElement('afterend', button);
    });
  }

  function decorateAuthCard() {
    const card = document.querySelector('#account .authCard');
    if (!card) return;
    const heading = card.querySelector('h3');
    if (heading) heading.textContent = 'Accedé a tu cuenta';
    if (!card.querySelector('.authIntro') && heading) {
      heading.insertAdjacentHTML('afterend', '<p class="authIntro">Ingresá para acceder a tu perfil y preferencias. Podés usar Google o tu email.</p>');
    }
    decoratePasswordFields();
  }

  function ensureAuthControls() {
    const status = $('authFormStatus');
    if (!status || document.getElementById('authFederatedActions')) return;
    status.insertAdjacentHTML('beforebegin', `
      <div class="authDivider" id="authDivider"><span>o continuá con</span></div>
      <div class="authFederatedActions" id="authFederatedActions">
        <button class="btn authGoogleButton" id="authGoogleButton" type="button" disabled aria-disabled="true"><span class="googleMark" aria-hidden="true">G</span> Continuar con Google</button>
        <button class="btn authLogoutButton" id="authLogoutButton" type="button" hidden>Cerrar sesión</button>
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
    const account = $('account');
    const tabs = document.querySelector('.authTabs');
    const googleButton = document.getElementById('authGoogleButton');
    const logoutButton = document.getElementById('authLogoutButton');
    const divider = document.getElementById('authDivider');
    const session = document.getElementById('authSession');
    const profileTitle = document.querySelector('.profilePreview b');
    const profileNote = document.querySelector('.profilePreview .productNote');
    const avatar = document.querySelector('.profileAvatar');
    const authHeading = document.querySelector('#account .authCard h3');
    const authIntro = document.querySelector('#account .authIntro');

    account?.classList.toggle('is-authenticated', Boolean(currentUser));
    account?.classList.toggle('is-anonymous', !currentUser);

    if (currentUser) {
      if (tabs) tabs.hidden = true;
      authForms().forEach((form) => { form.hidden = true; form.setAttribute('aria-hidden', 'true'); });
      if (googleButton) googleButton.hidden = true;
      if (divider) divider.hidden = true;
      if (logoutButton) logoutButton.hidden = false;
      if (authHeading) authHeading.textContent = 'Tu cuenta';
      if (authIntro) authIntro.textContent = 'Sesión iniciada. Tu identidad permanece separada del motor Quant y de cualquier ejecución de mercado.';
      if (session) {
        session.hidden = false;
        const identity = currentUser.displayName || currentUser.email || 'Usuario autenticado';
        const verification = currentUser.email ? (currentUser.emailVerified ? 'Email verificado' : 'Email pendiente de verificación') : 'Cuenta federada';
        session.textContent = `${identity} · ${verification}`;
      }
      if (profileTitle) profileTitle.textContent = currentUser.displayName || 'Perfil autenticado';
      if (profileNote) profileNote.textContent = `${currentUser.email || 'Cuenta Google'} · identidad gestionada de forma segura. Las preferencias continúan locales hasta una fase posterior.`;
      if (avatar) avatar.textContent = String(currentUser.displayName || currentUser.email || 'U').trim().slice(0, 1).toUpperCase();
      $('profileState').textContent = 'AUTENTICADO';
    } else {
      if (tabs) tabs.hidden = false;
      if (googleButton) googleButton.hidden = false;
      if (divider) divider.hidden = false;
      if (logoutButton) logoutButton.hidden = true;
      if (session) session.hidden = true;
      if (authHeading) authHeading.textContent = 'Accedé a tu cuenta';
      if (authIntro) authIntro.textContent = 'Ingresá para acceder a tu perfil y preferencias. Podés usar Google o tu email.';
      if (profileTitle) profileTitle.textContent = 'Sin sesión';
      if (profileNote) profileNote.textContent = 'Ingresá para asociar una identidad.';
      if (avatar) avatar.textContent = 'U';
      $('profileState').textContent = 'SIN SESIÓN';
      setAuthTab(activeAuthTab);
    }
  }

  function renderProductState() {
    $('productPhase').textContent = `FASE ${PRODUCT.phase}`;
    $('authProvider').textContent = PRODUCT.authProvider;
    const statusMap = {
      idle: ['CONFIGURADO', 'goodText'], loading: ['CONECTANDO', 'warnText'],
      ready: ['ACTIVO', 'goodText'], error: ['ERROR', 'badText'],
    };
    const [label, className] = statusMap[authState] || statusMap.error;
    $('authStatus').textContent = label;
    $('authStatus').className = className;
    $('membershipState').textContent = PRODUCT.membershipEnabled ? 'ACTIVO' : 'DISEÑO';
    $('deliveryState').textContent = PRODUCT.alertsDeliveryEnabled ? 'ACTIVO' : 'BLOQUEADO';
    setAuthControlsReady(authState === 'ready');

    if (currentUser) $('authGateMessage').textContent = 'Sesión protegida. Tus credenciales de acceso no se guardan manualmente en este sitio.';
    else if (authState === 'ready') $('authGateMessage').textContent = 'Acceso seguro disponible. Nunca te pediremos claves de exchange ni credenciales de trading.';
    else if (authState === 'error') $('authGateMessage').textContent = 'No pudimos conectar con el servicio de acceso. Intentá nuevamente en unos minutos.';
    else $('authGateMessage').textContent = 'Preparando acceso seguro…';
    renderAuthSession();
  }

  function loadPreferencesIntoForm() {
    const prefs = {
      horizon5m: true, horizon15m: true, web: true, email: false, whatsapp: false,
      minProbability: 72, quietHours: false, ...safeLoadPreferences(),
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
      horizon5m: $('pref5m').checked, horizon15m: $('pref15m').checked, web: $('prefWeb').checked,
      email: $('prefEmail').checked, whatsapp: $('prefWhatsapp').checked,
      minProbability: Number($('prefProbability').value), quietHours: $('prefQuiet').checked,
    };
    localStorage.setItem(PRODUCT.preferenceStorageKey, JSON.stringify(prefs));
    $('preferencesStatus').textContent = 'Preferencias guardadas sólo en este navegador. No modifican el modelo Quant.';
  }

  function authMessage(error) {
    const code = String(error?.code || '');
    const messages = {
      'auth/invalid-credential': 'Email o contraseña incorrectos.', 'auth/user-not-found': 'Email o contraseña incorrectos.',
      'auth/wrong-password': 'Email o contraseña incorrectos.', 'auth/email-already-in-use': 'Ese email ya tiene una cuenta. Probá ingresar.',
      'auth/weak-password': 'La contraseña no cumple la política de seguridad.', 'auth/invalid-email': 'Ingresá un email válido.',
      'auth/too-many-requests': 'Demasiados intentos. Esperá un momento antes de volver a probar.',
      'auth/network-request-failed': 'No pudimos conectar con el servicio de acceso. Revisá la conexión e intentá nuevamente.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google. Habilitá popups para este sitio.',
      'auth/popup-closed-by-user': 'Inicio con Google cancelado.', 'auth/cancelled-popup-request': 'Se canceló el intento anterior. Probá nuevamente.',
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
    authState = 'loading'; authError = null; renderProductState();
    try {
      const testFactory = window.__BTC_AUTH_TEST_ADAPTER_FACTORY__;
      if (typeof testFactory === 'function') authAdapter = await testFactory({ onState: handleAuthState });
      else {
        const module = await import('./firebase-auth.js');
        authAdapter = await module.createFirebaseAuthAdapter({ onState: handleAuthState });
      }
      authState = 'ready';
      currentUser = authAdapter.getCurrentUser?.() || currentUser;
      renderProductState();
      return authAdapter;
    } catch (error) {
      authState = 'error'; authError = error;
      $('authFormStatus').textContent = authMessage(error);
      renderProductState();
      return null;
    }
  }

  function setBusy(form, busy) {
    form?.querySelectorAll('button, input').forEach((control) => { if (control.type === 'submit') control.disabled = busy; });
    form?.setAttribute('aria-busy', String(busy));
  }

  async function submitEmailAuth(event) {
    event.preventDefault();
    if (!authAdapter || authState !== 'ready') return;
    const form = event.currentTarget;
    const mode = form.dataset.authForm;
    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"],input[type="text"][autocomplete$="password"]');
    const nameInput = form.querySelector('input[autocomplete="name"]');
    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');
    const name = String(nameInput?.value || '').trim();
    if (passwordInput) passwordInput.value = '';
    if (!email || !password) { $('authFormStatus').textContent = 'Completá email y contraseña.'; return; }

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
    } catch (error) { $('authFormStatus').textContent = authMessage(error); }
    finally { setBusy(form, false); renderProductState(); }
  }

  async function signInGoogle() {
    if (!authAdapter || authState !== 'ready') return;
    const button = document.getElementById('authGoogleButton');
    if (button) button.disabled = true;
    $('authFormStatus').textContent = 'Abriendo Google…';
    try { await authAdapter.signInGoogle(); $('authFormStatus').textContent = 'Sesión iniciada con Google.'; }
    catch (error) { $('authFormStatus').textContent = authMessage(error); }
    finally { if (button && !currentUser) button.disabled = false; renderProductState(); }
  }

  async function signOutAccount() {
    if (!authAdapter || authState !== 'ready') return;
    const button = document.getElementById('authLogoutButton');
    if (button) button.disabled = true;
    try { await authAdapter.signOut(); $('authFormStatus').textContent = 'Sesión cerrada.'; }
    catch (error) { $('authFormStatus').textContent = authMessage(error); }
    finally { if (button) button.disabled = false; renderProductState(); }
  }

  function initAccount() {
    if (initialized) return;
    initialized = true;
    decorateAuthCard();
    ensureAuthControls();
    document.querySelectorAll('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => setAuthTab(button.dataset.authTab)));
    authForms().forEach((form) => {
      form.addEventListener('submit', submitEmailAuth);
      form.querySelectorAll('input').forEach((input) => { input.required = true; });
    });
    $('preferencesForm')?.addEventListener('submit', savePreferences);
    $('prefProbability')?.addEventListener('input', () => { $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`; });
    document.getElementById('authGoogleButton')?.addEventListener('click', signInGoogle);
    document.getElementById('authLogoutButton')?.addEventListener('click', signOutAccount);
    setAuthTab('login'); renderProductState(); loadPreferencesIntoForm(); void loadAuthAdapter();
  }

  function boot() {
    syncPhaseCopy();
    ensurePaperEmptyState();
    document.querySelectorAll('[data-view="account"]').forEach((button) => button.addEventListener('click', initAccount, { once: true }));
    if ($('account')?.classList.contains('active')) initAccount();
  }

  window.BTC_PRODUCT = PRODUCT;
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
