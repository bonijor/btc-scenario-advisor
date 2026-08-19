(() => {
  'use strict';

  const state = { adapter: null, user: null, mode: 'pending', busy: false };
  const $ = (id) => document.getElementById(id);
  const protectedNodes = () => [document.querySelector('.app'), document.querySelector('.mobileNav'), document.querySelector('.skipLink')].filter(Boolean);

  function gateMarkup() {
    return `
      <div class="authGate" id="authGate" role="dialog" aria-modal="true" aria-labelledby="authGateTitle">
        <div class="authGateShell">
          <div class="authGateStatus" aria-label="Estado de acceso">
            <span><i aria-hidden="true"></i> Shadow Lab</span>
            <span><i aria-hidden="true"></i> API read-only</span>
          </div>
          <div class="authGateCard">
            <header class="authGateBrand">
              <div class="authGateCoin" aria-hidden="true">₿</div>
              <h1 id="authGateTitle">BTC Scenario Advisor</h1>
              <p>Tu ventaja estratégica, bajo control</p>
              <small>Shadow Lab · acceso protegido</small>
            </header>

            <section data-gate-panel="pending">
              <div class="authGateVerify">
                <div class="authGateVerifyIcon" aria-hidden="true">◌</div>
                <h2>Validando sesión</h2>
                <p>Comprobando tu identidad antes de mostrar el dashboard.</p>
              </div>
            </section>

            <section data-gate-panel="login" hidden>
              <form class="authGateForm" id="gateLoginForm" novalidate>
                <div class="authGateField"><label for="gateLoginEmail">Email</label><input id="gateLoginEmail" type="email" autocomplete="email" inputmode="email" placeholder="tu@email.com" required></div>
                <div class="authGateField"><label for="gateLoginPassword">Contraseña</label><input id="gateLoginPassword" type="password" autocomplete="current-password" placeholder="••••••••" required><button class="authGatePasswordToggle" type="button" data-toggle-password="gateLoginPassword" aria-label="Mostrar contraseña">◉</button></div>
                <button class="authGateButton" id="gateLoginButton" type="submit">INGRESAR</button>
                <div class="authGateDivider"><span>o</span></div>
                <button class="authGateButton secondary authGateGoogle" id="gateGoogleButton" type="button"><span class="authGateGoogleMark" aria-hidden="true">G</span> Continuar con Google</button>
              </form>
              <div class="authGateLinks"><button class="authGateLink" type="button" data-gate-mode="register">Crear una cuenta</button><button class="authGateLink accent" type="button" data-gate-mode="reset">¿Olvidaste tu contraseña?</button></div>
            </section>

            <section data-gate-panel="register" hidden>
              <form class="authGateForm" id="gateRegisterForm" novalidate>
                <div class="authGateField"><label for="gateRegisterName">Nombre</label><input id="gateRegisterName" type="text" autocomplete="name" maxlength="80" placeholder="Tu nombre" required></div>
                <div class="authGateField"><label for="gateRegisterEmail">Email</label><input id="gateRegisterEmail" type="email" autocomplete="email" inputmode="email" placeholder="tu@email.com" required></div>
                <div class="authGateField"><label for="gateRegisterPassword">Contraseña</label><input id="gateRegisterPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres" required><button class="authGatePasswordToggle" type="button" data-toggle-password="gateRegisterPassword" aria-label="Mostrar contraseña">◉</button></div>
                <button class="authGateButton" type="submit">CREAR CUENTA</button>
              </form>
              <div class="authGateLinks"><button class="authGateLink" type="button" data-gate-mode="login">Ya tengo una cuenta</button></div>
            </section>

            <section data-gate-panel="reset" hidden>
              <form class="authGateForm" id="gateResetForm" novalidate>
                <div class="authGateField"><label for="gateResetEmail">Email</label><input id="gateResetEmail" type="email" autocomplete="email" inputmode="email" placeholder="tu@email.com" required></div>
                <button class="authGateButton" type="submit">ENVIAR RECUPERACIÓN</button>
              </form>
              <div class="authGateLinks"><button class="authGateLink" type="button" data-gate-mode="login">Volver a ingresar</button></div>
            </section>

            <section class="authGateVerify" data-gate-panel="verify" hidden>
              <div class="authGateVerifyIcon" aria-hidden="true">✉</div>
              <h2>Verificá tu email</h2>
              <p id="gateVerifyText">Te enviamos un enlace de verificación. El dashboard se abrirá cuando tu correo esté confirmado.</p>
              <div class="authGateForm">
                <button class="authGateButton" id="gateCheckVerification" type="button">YA VERIFIQUÉ</button>
                <button class="authGateButton secondary" id="gateResendVerification" type="button">Reenviar verificación</button>
              </div>
              <div class="authGateLinks"><button class="authGateLink" id="gateVerifyLogout" type="button">Usar otra cuenta</button></div>
            </section>

            <p class="authGateMessage" id="gateMessage" aria-live="polite"></p>
            <p class="authGateSecurity">Firebase Authentication · perfil privado en nube · SHADOW only · sin órdenes reales</p>
          </div>
        </div>
      </div>`;
  }

  function setProtectedLocked(locked) {
    protectedNodes().forEach((node) => {
      if (locked) node.setAttribute('inert', '');
      else node.removeAttribute('inert');
      node.setAttribute('aria-hidden', String(locked));
    });
  }

  function setMessage(text = '', type = '') {
    const el = $('gateMessage');
    if (!el) return;
    el.textContent = text;
    el.className = `authGateMessage${type ? ` ${type}` : ''}`;
  }

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-gate-panel]').forEach((panel) => { panel.hidden = panel.dataset.gatePanel !== mode; });
    setMessage('');
    if (mode === 'login') requestAnimationFrame(() => $('gateLoginEmail')?.focus());
    if (mode === 'register') requestAnimationFrame(() => $('gateRegisterName')?.focus());
    if (mode === 'reset') {
      const source = $('gateLoginEmail')?.value || state.user?.email || '';
      if ($('gateResetEmail') && !$('gateResetEmail').value) $('gateResetEmail').value = source;
      requestAnimationFrame(() => $('gateResetEmail')?.focus());
    }
  }

  function setBusy(busy) {
    state.busy = busy;
    document.querySelectorAll('#authGate button,#authGate input').forEach((el) => { el.disabled = busy; });
    const primary = document.querySelector(`[data-gate-panel="${state.mode}"] .authGateButton`);
    if (primary && busy) primary.setAttribute('aria-busy', 'true');
    else primary?.removeAttribute('aria-busy');
  }

  function authErrorMessage(error) {
    const code = String(error?.code || '');
    const map = {
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/invalid-email': 'Revisá el formato del email.',
      'auth/user-disabled': 'Esta cuenta está deshabilitada.',
      'auth/email-already-in-use': 'Ese email ya tiene una cuenta.',
      'auth/weak-password': 'La contraseña no cumple la seguridad mínima.',
      'auth/popup-closed-by-user': 'La ventana de Google se cerró antes de completar el acceso.',
      'auth/popup-blocked': 'El navegador bloqueó la ventana de Google.',
      'auth/too-many-requests': 'Demasiados intentos. Esperá unos minutos y probá nuevamente.',
      'auth/network-request-failed': 'No pudimos conectar con el servicio de identidad.',
    };
    return map[code] || 'No pudimos completar el acceso. Revisá los datos e intentá nuevamente.';
  }

  function beginDashboardLoading() {
    document.body.classList.add('dashboard-loading');
    const api = $('apiStatus');
    const market = $('marketStatus');
    let observer = null;
    const ready = () => {
      const apiText = String(api?.textContent || '').trim();
      const marketText = String(market?.textContent || '').trim();
      if (apiText && apiText !== '--' && marketText && marketText !== '--') {
        document.body.classList.remove('dashboard-loading');
        observer?.disconnect();
      }
    };
    observer = new MutationObserver(ready);
    [api, market].filter(Boolean).forEach((node) => observer.observe(node, { childList: true, subtree: true, characterData: true }));
    ready();
    setTimeout(() => { document.body.classList.remove('dashboard-loading'); observer?.disconnect(); }, 10000);
  }

  function grant(user) {
    state.user = user;
    document.body.classList.add('auth-granted', 'auth-gate-ready');
    document.body.classList.remove('auth-denied');
    document.body.style.overflow = '';
    setProtectedLocked(false);
    const gate = $('authGate');
    if (gate) gate.hidden = true;
    beginDashboardLoading();
    window.dispatchEvent(new CustomEvent('btc:auth-granted', { detail: { uid: user.uid, emailVerified: true } }));
  }

  function lock(user = null) {
    state.user = user;
    document.body.classList.remove('auth-granted');
    document.body.classList.add('auth-gate-ready', 'auth-denied');
    document.body.style.overflow = 'hidden';
    setProtectedLocked(true);
    const gate = $('authGate');
    if (gate) gate.hidden = false;
    if (user && user.emailVerified !== true) {
      if ($('gateVerifyText')) $('gateVerifyText').textContent = `Enviamos la verificación a ${user.email || 'tu email'}. Confirmala para abrir el Shadow Lab.`;
      setMode('verify');
    } else {
      setMode('login');
    }
  }

  function handleAuthState(user, error) {
    if (error) {
      lock(null);
      setMessage('La sesión no pudo validarse. El dashboard permanece bloqueado.', 'error');
      return;
    }
    if (user?.emailVerified === true) grant(user);
    else lock(user || null);
  }

  async function run(action) {
    if (state.busy || !state.adapter) return;
    setBusy(true);
    setMessage('');
    try { await action(); }
    catch (error) { setMessage(authErrorMessage(error), 'error'); }
    finally { setBusy(false); }
  }

  function bindUi() {
    document.querySelectorAll('[data-gate-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.gateMode)));
    document.querySelectorAll('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => {
      const input = $(button.dataset.togglePassword);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? '◌' : '◉';
      button.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
    }));

    $('gateLoginForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = $('gateLoginEmail').value.trim();
      const password = $('gateLoginPassword').value;
      if (!email || !password) return setMessage('Completá email y contraseña.', 'error');
      void run(() => state.adapter.signInEmail({ email, password }));
    });

    $('gateRegisterForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('gateRegisterName').value.trim();
      const email = $('gateRegisterEmail').value.trim();
      const password = $('gateRegisterPassword').value;
      if (!name || !email || !password) return setMessage('Completá nombre, email y contraseña.', 'error');
      void run(async () => {
        await state.adapter.registerEmail({ name, email, password });
        setMessage('Cuenta creada. Revisá tu email para verificarla.', 'success');
      });
    });

    $('gateResetForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = $('gateResetEmail').value.trim();
      if (!email) return setMessage('Ingresá el email de tu cuenta.', 'error');
      void run(async () => {
        await state.adapter.resetPassword(email);
        setMode('login');
        if ($('gateLoginEmail')) $('gateLoginEmail').value = email;
        setMessage('Te enviamos un enlace para recuperar la contraseña.', 'success');
      });
    });

    $('gateGoogleButton')?.addEventListener('click', () => { void run(() => state.adapter.signInGoogle()); });
    $('gateCheckVerification')?.addEventListener('click', () => { void run(async () => {
      const user = await state.adapter.refreshCurrentUser();
      if (user?.emailVerified === true) grant(user);
      else setMessage('Todavía no aparece verificado. Abrí el enlace del email y volvé a comprobar.', 'error');
    }); });
    $('gateResendVerification')?.addEventListener('click', () => { void run(async () => {
      await state.adapter.sendVerification();
      setMessage('Enviamos un nuevo email de verificación.', 'success');
    }); });
    $('gateVerifyLogout')?.addEventListener('click', () => { void run(() => state.adapter.signOut()); });
  }

  async function start() {
    if ($('authGate')) return;
    document.body.insertAdjacentHTML('beforeend', gateMarkup());
    document.body.classList.add('auth-gate-ready');
    document.body.style.overflow = 'hidden';
    setProtectedLocked(true);
    bindUi();
    try {
      const module = await import('./firebase-auth.js');
      state.adapter = await module.createFirebaseAuthAdapter({ onState: handleAuthState });
      const current = state.adapter.getCurrentUser?.();
      if (current) handleAuthState(current, null);
      else if (state.mode === 'pending') lock(null);
    } catch (error) {
      lock(null);
      setMessage('Firebase Authentication no está disponible. El dashboard permanece bloqueado.', 'error');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else void start();
})();
