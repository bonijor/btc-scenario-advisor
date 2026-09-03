(() => {
  'use strict';

  if (window.__BTC_PERF_QA__ === true) return;

  const PRODUCT = Object.freeze({
    phase: '2D',
    uxRevision: '2C',
    authProvider: 'Firebase Authentication',
    profileProvider: 'Cloud Firestore',
    authEnabled: true,
    serverProfileEnabled: true,
    entitlementReadOnly: true,
    membershipEnabled: false,
    alertsDeliveryEnabled: false,
    preferenceStorageKey: 'btcScenarioPreferencesPreviewV1',
  });

  const $ = (id) => document.getElementById(id);
  const authForms = () => [...document.querySelectorAll('[data-auth-form]')];
  let initialized = false;
  let authAdapter = null;
  let profileAdapter = null;
  let authState = 'idle';
  let authError = null;
  let cloudState = 'idle';
  let cloudError = null;
  let cloudWorkspace = null;
  let currentUser = null;
  let loadedUid = null;
  let activeAuthTab = 'login';
  let paperObserver = null;

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
  }

  function ensureStylesheet(href) {
    if ([...document.styleSheets].some((sheet) => String(sheet.href || '').endsWith(href))) return;
    if (document.querySelector(`link[data-product-style="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.productStyle = href;
    document.head.appendChild(link);
  }

  function syncNavigationCopy() {
    const desktop = {
      overview: '▦ Resumen', analytics: '⌁ Modelo', paper: '◎ Simulación',
      trial: '◷ Evidencia 90D', system: '⚙ Sistema', account: '◉ Cuenta',
    };
    const mobile = {
      overview: 'Resumen', analytics: 'Modelo', paper: 'Simulación',
      trial: 'Evidencia', system: 'Más', account: 'Cuenta',
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
    setText('#analytics .ey', 'Modelo Quant · 5m y 15m');
    setText('#analytics h2', '¿Qué tan confiable es el modelo?');
    const analyticsIntro = document.querySelector('#analytics .content > p.tiny');
    if (analyticsIntro) analyticsIntro.textContent = 'Métricas oficiales de la API de sólo lectura. Ayudan a evaluar calidad predictiva; no representan ganancias ni modifican el modelo durante el trial.';
  }

  function syncPhaseCopy() {
    if ($('productPhase')) $('productPhase').textContent = `FASE ${PRODUCT.phase}`;
    const systemIdentity = document.querySelector('#system .lockedFeature');
    if (systemIdentity) {
      const title = systemIdentity.querySelector('b');
      const note = systemIdentity.querySelector('small');
      if (title) title.textContent = '🔐 Cuenta privada · perfil en nube';
      if (note) note.textContent = 'Firebase Authentication identifica al usuario y Cloud Firestore guarda sólo perfil y preferencias. El motor Quant permanece aislado.';
    }
    const heroEy = document.querySelector('#account .productHero .ey');
    if (heroEy) heroEy.textContent = 'Espacio privado de usuario';
    const heroTitle = document.querySelector('#account .productHero h2');
    if (heroTitle) heroTitle.textContent = 'Cuenta, perfil y preferencias en nube';
    const heroNote = document.querySelector('#account .productHero .productNote');
    if (heroNote) heroNote.textContent = 'Tu identidad y preferencias viven en una capa de producto separada. Ningún dato de cuenta puede modificar V5.9.0 ni habilitar ejecución de mercado.';
    const planNote = document.querySelector('#account .membershipCard > p.tiny');
    if (planNote) planNote.textContent = 'La lectura de plan está preparada como autoridad de servidor. El navegador no puede crear ni modificar membresías y todavía no existen cobros.';
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

  function cachePreferences(preferences) {
    try { localStorage.setItem(PRODUCT.preferenceStorageKey, JSON.stringify(preferences)); } catch { /* cache best effort */ }
  }

  function defaultPreferences() {
    return {
      horizon5m: true,
      horizon15m: true,
      web: true,
      email: false,
      whatsapp: false,
      minProbability: 72,
      quietHours: false,
    };
  }

  function preferencesFromForm() {
    return {
      horizon5m: $('pref5m').checked,
      horizon15m: $('pref15m').checked,
      web: $('prefWeb').checked,
      email: $('prefEmail').checked,
      whatsapp: $('prefWhatsapp').checked,
      minProbability: Number($('prefProbability').value),
      quietHours: $('prefQuiet').checked,
    };
  }

  function applyPreferences(preferences = {}) {
    const prefs = { ...defaultPreferences(), ...preferences };
    $('pref5m').checked = prefs.horizon5m === true;
    $('pref15m').checked = prefs.horizon15m === true;
    $('prefWeb').checked = prefs.web === true;
    $('prefEmail').checked = prefs.email === true;
    $('prefWhatsapp').checked = prefs.whatsapp === true;
    $('prefProbability').value = String(Math.max(50, Math.min(99, Number(prefs.minProbability) || 72)));
    $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`;
    $('prefQuiet').checked = prefs.quietHours === true;
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
      heading.insertAdjacentHTML('afterend', '<p class="authIntro">Ingresá para abrir tu espacio privado. Podés usar Google o tu email.</p>');
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

  function ensureCloudWorkspaceUi() {
    ensureStylesheet('assets/cloud-profile.css');
    const card = document.querySelector('#account .preferencesCard');
    const preview = card?.querySelector('.profilePreview');
    if (!card || !preview || document.getElementById('cloudProfilePanel')) return;

    preview.insertAdjacentHTML('beforebegin', `
      <div class="privateWorkspaceBanner" id="privateWorkspaceBanner">
        <div><b>🔐 Espacio privado</b><small>Perfil y preferencias sincronizados por usuario. Esta capa no tiene permisos sobre el motor Quant.</small></div>
        <span class="cloudSyncBadge warn" id="cloudSyncBadge">NUBE PENDIENTE</span>
      </div>
      <div class="cloudProfilePanel" id="cloudProfilePanel">
        <div class="cloudProfileHead"><strong>Perfil de usuario</strong><span class="tiny" id="cloudProfileStatus" aria-live="polite">Preparando sincronización…</span></div>
        <form class="cloudProfileForm" id="cloudProfileForm">
          <div class="field"><label for="profileDisplayName">Nombre visible</label><input id="profileDisplayName" type="text" maxlength="80" autocomplete="name" placeholder="Tu nombre"></div>
          <button class="btn" type="submit">Guardar perfil</button>
        </form>
        <div class="cloudMeta">
          <div><span>Persistencia</span><strong id="profileStorageState">PENDIENTE</strong><small>Cloud Firestore</small></div>
          <div><span>Plan visible</span><strong id="profilePlanState">FREE</strong><small id="profilePlanSource">sin entitlement pago</small></div>
        </div>
        <div class="cloudStateNote" id="cloudStateNote">Tus preferencias mantienen una caché local para resiliencia, pero la fuente persistente será la nube.</div>
      </div>
    `);

    const membershipCard = document.querySelector('#account .membershipCard');
    if (membershipCard && !membershipCard.querySelector('.planAuthorityNote')) {
      membershipCard.insertAdjacentHTML('beforeend', '<div class="planAuthorityNote"><b>Autoridad de membresía:</b> cualquier entitlement futuro será sólo lectura en el navegador y deberá ser emitido por backend. Nunca habilitará órdenes de mercado.</div>');
    }
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

  function cloudPlan() {
    const plan = String(cloudWorkspace?.entitlement?.plan || 'free').toLowerCase();
    return ['free', 'pro', 'premium'].includes(plan) ? plan : 'free';
  }

  function renderCloudState() {
    const badge = $('cloudSyncBadge');
    const status = $('cloudProfileStatus');
    const storage = $('profileStorageState');
    const planState = $('profilePlanState');
    const planSource = $('profilePlanSource');
    const note = $('cloudStateNote');
    const profileInput = $('profileDisplayName');

    if (planState) planState.textContent = cloudPlan().toUpperCase();
    if (planSource) planSource.textContent = cloudWorkspace?.entitlement ? 'entitlement de servidor · sólo lectura' : 'sin entitlement pago';

    const stateMap = {
      idle: ['NUBE PENDIENTE', 'warn', 'PENDIENTE'],
      loading: ['SINCRONIZANDO', 'warn', 'SINCRONIZANDO'],
      ready: ['EN NUBE', 'good', 'CLOUD FIRESTORE'],
      degraded: ['MODO LOCAL', 'warn', 'CACHÉ LOCAL'],
      error: ['ERROR NUBE', 'bad', 'NO DISPONIBLE'],
    };
    const [label, className, storageLabel] = stateMap[cloudState] || stateMap.error;
    if (badge) {
      badge.textContent = label;
      badge.className = `cloudSyncBadge ${className}`;
    }
    if (storage) storage.textContent = storageLabel;

    if (status) {
      if (cloudState === 'ready') status.textContent = 'Sincronizado';
      else if (cloudState === 'loading') status.textContent = 'Sincronizando…';
      else if (cloudState === 'degraded') status.textContent = 'Nube pendiente · usando caché local';
      else if (cloudState === 'error') status.textContent = 'No pudimos abrir la nube';
      else status.textContent = 'Preparando sincronización…';
    }
    if (note) {
      note.textContent = cloudState === 'ready'
        ? 'Perfil y preferencias se guardan por UID. La caché local sólo acelera recuperación y nunca contiene contraseñas ni tokens.'
        : 'Tus cambios pueden mantenerse localmente mientras la persistencia en nube no esté disponible.';
    }

    if (profileInput && currentUser && document.activeElement !== profileInput) {
      profileInput.value = cloudWorkspace?.profile?.displayName || currentUser.displayName || '';
    }

    if ($('profileState')) {
      $('profileState').textContent = currentUser
        ? (cloudState === 'ready' ? 'EN NUBE' : cloudState === 'loading' ? 'SINCRONIZANDO' : 'AUTENTICADO')
        : 'SIN SESIÓN';
    }
    if ($('membershipState')) $('membershipState').textContent = currentUser ? cloudPlan().toUpperCase() : 'DISEÑO';
  }

  function renderAuthSession() {
    const account = $('account');
    const tabs = document.querySelector('.authTabs');
    const googleButton = $('authGoogleButton');
    const logoutButton = $('authLogoutButton');
    const divider = $('authDivider');
    const session = $('authSession');
    const profileTitle = document.querySelector('.profilePreview b');
    const profileNote = document.querySelector('.profilePreview .productNote');
    const avatar = document.querySelector('.profileAvatar');
    const authHeading = document.querySelector('#account .authCard h3');
    const authIntro = document.querySelector('#account .authIntro');

    account?.classList.toggle('is-authenticated', Boolean(currentUser));
    account?.classList.toggle('is-anonymous', !currentUser);

    if (currentUser) {
      const displayName = cloudWorkspace?.profile?.displayName || currentUser.displayName || '';
      if (tabs) tabs.hidden = true;
      authForms().forEach((form) => { form.hidden = true; form.setAttribute('aria-hidden', 'true'); });
      if (googleButton) googleButton.hidden = true;
      if (divider) divider.hidden = true;
      if (logoutButton) logoutButton.hidden = false;
      if (authHeading) authHeading.textContent = 'Tu cuenta';
      if (authIntro) authIntro.textContent = 'Sesión iniciada. Tu espacio privado está separado del motor Quant y de cualquier ejecución de mercado.';
      if (session) {
        session.hidden = false;
        const identity = displayName || currentUser.email || 'Usuario autenticado';
        const verification = currentUser.email ? (currentUser.emailVerified ? 'Email verificado' : 'Email pendiente de verificación') : 'Cuenta federada';
        session.textContent = `${identity} · ${verification}`;
      }
      if (profileTitle) profileTitle.textContent = displayName || 'Perfil autenticado';
      if (profileNote) {
        const storageText = cloudState === 'ready' ? 'perfil y preferencias sincronizados en nube' : 'persistencia en nube pendiente';
        profileNote.textContent = `${currentUser.email || 'Cuenta Google'} · ${storageText}.`;
      }
      if (avatar) avatar.textContent = String(displayName || currentUser.email || 'U').trim().slice(0, 1).toUpperCase();
    } else {
      if (tabs) tabs.hidden = false;
      if (googleButton) googleButton.hidden = false;
      if (divider) divider.hidden = false;
      if (logoutButton) logoutButton.hidden = true;
      if (session) session.hidden = true;
      if (authHeading) authHeading.textContent = 'Accedé a tu cuenta';
      if (authIntro) authIntro.textContent = 'Ingresá para abrir tu espacio privado. Podés usar Google o tu email.';
      if (profileTitle) profileTitle.textContent = 'Sin sesión';
      if (profileNote) profileNote.textContent = 'Ingresá para asociar una identidad.';
      if (avatar) avatar.textContent = 'U';
      setAuthTab(activeAuthTab);
    }
  }

  function renderProductState() {
    if ($('productPhase')) $('productPhase').textContent = `FASE ${PRODUCT.phase}`;
    if ($('authProvider')) $('authProvider').textContent = PRODUCT.authProvider;
    const statusMap = {
      idle: ['CONFIGURADO', 'goodText'], loading: ['CONECTANDO', 'warnText'],
      ready: ['ACTIVO', 'goodText'], error: ['ERROR', 'badText'],
    };
    const [label, className] = statusMap[authState] || statusMap.error;
    if ($('authStatus')) {
      $('authStatus').textContent = label;
      $('authStatus').className = className;
    }
    if ($('deliveryState')) $('deliveryState').textContent = PRODUCT.alertsDeliveryEnabled ? 'ACTIVO' : 'BLOQUEADO';
    setAuthControlsReady(authState === 'ready');

    if ($('authGateMessage')) {
      if (currentUser) $('authGateMessage').textContent = 'Sesión protegida. Contraseñas y tokens no se guardan manualmente en este sitio.';
      else if (authState === 'ready') $('authGateMessage').textContent = 'Acceso seguro disponible. Nunca te pediremos claves de exchange ni credenciales de trading.';
      else if (authState === 'error') $('authGateMessage').textContent = 'No pudimos conectar con el servicio de acceso. Intentá nuevamente en unos minutos.';
      else $('authGateMessage').textContent = 'Preparando acceso seguro…';
    }
    renderAuthSession();
    renderCloudState();
  }

  function loadPreferencesIntoForm() {
    applyPreferences({ ...defaultPreferences(), ...safeLoadPreferences() });
  }

  function cloudMessage(error) {
    const code = String(error?.code || '');
    if (code.includes('permission-denied')) return 'La nube rechazó el acceso. La cuenta sigue abierta, pero la sincronización está bloqueada.';
    if (code.includes('not-found')) return 'Cloud Firestore todavía no está disponible para este proyecto.';
    if (code.includes('unavailable')) return 'Cloud Firestore está temporalmente no disponible.';
    return 'No pudimos sincronizar con la nube. Se mantiene una caché local no sensible.';
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

  async function loadProfileAdapter() {
    if (profileAdapter) return profileAdapter;
    const testFactory = window.__BTC_PROFILE_TEST_ADAPTER_FACTORY__;
    if (typeof testFactory === 'function') profileAdapter = await testFactory();
    else {
      const module = await import('./firebase-profile.js');
      profileAdapter = await module.createFirebaseProfileAdapter();
    }
    return profileAdapter;
  }

  async function loadCloudWorkspace(user) {
    if (!user?.uid || loadedUid === user.uid && cloudState === 'ready') return;
    const targetUid = user.uid;
    cloudState = 'loading';
    cloudError = null;
    renderProductState();
    try {
      const adapter = await loadProfileAdapter();
      const ensured = await adapter.ensureProfile({ uid: targetUid, displayName: user.displayName || '' });
      const workspace = await adapter.loadWorkspace(targetUid);
      if (!currentUser || currentUser.uid !== targetUid) return;
      cloudWorkspace = Object.freeze({
        profile: workspace.profile || ensured,
        preferences: workspace.preferences || null,
        entitlement: workspace.entitlement || null,
      });
      loadedUid = targetUid;
      if (cloudWorkspace.preferences) {
        applyPreferences(cloudWorkspace.preferences);
        cachePreferences(cloudWorkspace.preferences);
        if ($('preferencesStatus')) $('preferencesStatus').textContent = 'Preferencias cargadas desde la nube.';
      } else {
        loadPreferencesIntoForm();
        if ($('preferencesStatus')) $('preferencesStatus').textContent = 'Todavía no hay preferencias en nube. Guardá una vez para sincronizarlas.';
      }
      cloudState = 'ready';
      renderProductState();
    } catch (error) {
      if (!currentUser || currentUser.uid !== targetUid) return;
      cloudError = error;
      cloudState = 'degraded';
      cloudWorkspace = null;
      loadPreferencesIntoForm();
      if ($('preferencesStatus')) $('preferencesStatus').textContent = cloudMessage(error);
      renderProductState();
    }
  }

  function resetCloudWorkspace() {
    cloudWorkspace = null;
    cloudError = null;
    cloudState = 'idle';
    loadedUid = null;
    loadPreferencesIntoForm();
    renderCloudState();
  }

  function handleAuthState(user, error) {
    const previousUid = currentUser?.uid || null;
    currentUser = user || null;
    authError = error || null;
    if (error) authState = 'error';
    if (!currentUser) resetCloudWorkspace();
    renderProductState();
    if (currentUser && (previousUid !== currentUser.uid || cloudState !== 'ready')) void loadCloudWorkspace(currentUser);
  }

  async function loadAuthAdapter() {
    if (authAdapter || authState === 'loading') return authAdapter;
    authState = 'loading';
    authError = null;
    renderProductState();
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
      if (currentUser) void loadCloudWorkspace(currentUser);
      return authAdapter;
    } catch (error) {
      authState = 'error';
      authError = error;
      if ($('authFormStatus')) $('authFormStatus').textContent = authMessage(error);
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
    const passwordInput = form.querySelector('input[type="password"],input[type="text"][autocomplete$="password"]');
    const nameInput = form.querySelector('input[autocomplete="name"]');
    const email = String(emailInput?.value || '').trim();
    const password = String(passwordInput?.value || '');
    const name = String(nameInput?.value || '').trim();
    if (passwordInput) passwordInput.value = '';
    if (!email || !password) {
      if ($('authFormStatus')) $('authFormStatus').textContent = 'Completá email y contraseña.';
      return;
    }

    setBusy(form, true);
    if ($('authFormStatus')) $('authFormStatus').textContent = mode === 'register' ? 'Creando cuenta…' : 'Ingresando…';
    try {
      if (mode === 'register') {
        await authAdapter.registerEmail({ name, email, password });
        if ($('authFormStatus')) $('authFormStatus').textContent = 'Cuenta creada. Enviamos un email de verificación.';
      } else {
        await authAdapter.signInEmail({ email, password });
        if ($('authFormStatus')) $('authFormStatus').textContent = 'Sesión iniciada correctamente.';
      }
    } catch (error) {
      if ($('authFormStatus')) $('authFormStatus').textContent = authMessage(error);
    } finally {
      setBusy(form, false);
      renderProductState();
    }
  }

  async function signInGoogle() {
    if (!authAdapter || authState !== 'ready') return;
    const button = $('authGoogleButton');
    if (button) button.disabled = true;
    if ($('authFormStatus')) $('authFormStatus').textContent = 'Abriendo Google…';
    try {
      await authAdapter.signInGoogle();
      if ($('authFormStatus')) $('authFormStatus').textContent = 'Sesión iniciada con Google.';
    } catch (error) {
      if ($('authFormStatus')) $('authFormStatus').textContent = authMessage(error);
    } finally {
      if (button && !currentUser) button.disabled = false;
      renderProductState();
    }
  }

  async function signOutAccount() {
    if (!authAdapter || authState !== 'ready') return;
    const button = $('authLogoutButton');
    if (button) button.disabled = true;
    try {
      await authAdapter.signOut();
      if ($('authFormStatus')) $('authFormStatus').textContent = 'Sesión cerrada.';
    } catch (error) {
      if ($('authFormStatus')) $('authFormStatus').textContent = authMessage(error);
    } finally {
      if (button) button.disabled = false;
      renderProductState();
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!currentUser || cloudState !== 'ready') {
      if ($('cloudProfileStatus')) $('cloudProfileStatus').textContent = 'La nube todavía no está disponible.';
      return;
    }
    const form = event.currentTarget;
    const displayName = String($('profileDisplayName')?.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!displayName) {
      if ($('cloudProfileStatus')) $('cloudProfileStatus').textContent = 'Ingresá un nombre visible.';
      return;
    }
    setBusy(form, true);
    if ($('cloudProfileStatus')) $('cloudProfileStatus').textContent = 'Guardando…';
    try {
      const adapter = await loadProfileAdapter();
      const profile = await adapter.saveProfile({ uid: currentUser.uid, displayName });
      if (typeof authAdapter?.updateDisplayName === 'function') await authAdapter.updateDisplayName(displayName);
      cloudWorkspace = Object.freeze({ ...(cloudWorkspace || {}), profile });
      if ($('cloudProfileStatus')) $('cloudProfileStatus').textContent = 'Perfil sincronizado.';
      renderProductState();
    } catch (error) {
      cloudError = error;
      if ($('cloudProfileStatus')) $('cloudProfileStatus').textContent = cloudMessage(error);
    } finally {
      setBusy(form, false);
    }
  }

  async function savePreferences(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const prefs = preferencesFromForm();
    cachePreferences(prefs);

    if (!currentUser || cloudState !== 'ready') {
      if ($('preferencesStatus')) $('preferencesStatus').textContent = 'Guardadas en caché local. La sincronización en nube está pendiente.';
      return;
    }

    setBusy(form, true);
    if ($('preferencesStatus')) $('preferencesStatus').textContent = 'Sincronizando preferencias…';
    try {
      const adapter = await loadProfileAdapter();
      const saved = await adapter.savePreferences(currentUser.uid, prefs);
      cloudWorkspace = Object.freeze({ ...(cloudWorkspace || {}), preferences: saved });
      cachePreferences(saved);
      if ($('preferencesStatus')) $('preferencesStatus').textContent = 'Preferencias sincronizadas en nube. No modifican el modelo Quant.';
      renderCloudState();
    } catch (error) {
      cloudError = error;
      if ($('preferencesStatus')) $('preferencesStatus').textContent = `${cloudMessage(error)} Los cambios quedaron en caché local.`;
    } finally {
      setBusy(form, false);
    }
  }

  function initAccount() {
    if (initialized) return;
    initialized = true;
    decorateAuthCard();
    ensureAuthControls();
    ensureCloudWorkspaceUi();
    document.querySelectorAll('[data-auth-tab]').forEach((button) => button.addEventListener('click', () => {
      if ($('authFormStatus')) $('authFormStatus').textContent = '';
      setAuthTab(button.dataset.authTab);
    }));
    authForms().forEach((form) => {
      form.addEventListener('submit', submitEmailAuth);
      form.querySelectorAll('input').forEach((input) => { input.required = true; });
    });
    $('cloudProfileForm')?.addEventListener('submit', saveProfile);
    $('preferencesForm')?.addEventListener('submit', savePreferences);
    $('prefProbability')?.addEventListener('input', () => {
      $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`;
    });
    $('authGoogleButton')?.addEventListener('click', signInGoogle);
    $('authLogoutButton')?.addEventListener('click', signOutAccount);
    setAuthTab('login');
    loadPreferencesIntoForm();
    renderProductState();
    void loadAuthAdapter();
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
