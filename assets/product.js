(() => {
  'use strict';

  const PRODUCT = Object.freeze({
    phase: '2A',
    authProvider: 'Firebase Authentication',
    authEnabled: false,
    membershipEnabled: false,
    serverProfileEnabled: false,
    alertsDeliveryEnabled: false,
    preferenceStorageKey: 'btcScenarioPreferencesPreviewV1',
  });

  const $ = (id) => document.getElementById(id);
  const authForms = () => [...document.querySelectorAll('[data-auth-form]')];

  function safeLoadPreferences() {
    try {
      const value = JSON.parse(localStorage.getItem(PRODUCT.preferenceStorageKey) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch {
      return {};
    }
  }

  function setAuthTab(name) {
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
      const active = button.dataset.authTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.setAttribute('tabindex', active ? '0' : '-1');
    });
    authForms().forEach((form) => {
      const active = form.dataset.authForm === name;
      form.hidden = !active;
      form.setAttribute('aria-hidden', String(!active));
    });
  }

  function renderProductState() {
    $('productPhase').textContent = `FASE ${PRODUCT.phase}`;
    $('authProvider').textContent = PRODUCT.authProvider;
    $('authStatus').textContent = PRODUCT.authEnabled ? 'CONFIGURADO' : 'PENDIENTE';
    $('authStatus').className = PRODUCT.authEnabled ? 'goodText' : 'warnText';
    $('profileState').textContent = PRODUCT.serverProfileEnabled ? 'SINCRONIZADO' : 'PREVIEW LOCAL';
    $('membershipState').textContent = PRODUCT.membershipEnabled ? 'ACTIVO' : 'DISEÑO';
    $('deliveryState').textContent = PRODUCT.alertsDeliveryEnabled ? 'ACTIVO' : 'BLOQUEADO';

    document.querySelectorAll('[data-requires-auth]').forEach((control) => {
      control.disabled = !PRODUCT.authEnabled;
      control.setAttribute('aria-disabled', String(!PRODUCT.authEnabled));
    });

    const gate = $('authGateMessage');
    gate.textContent = PRODUCT.authEnabled
      ? 'Proveedor de identidad configurado. La sesión se resolverá mediante el adaptador seguro.'
      : 'Identidad todavía no conectada. Registro e ingreso permanecen bloqueados para no simular cuentas ni almacenar credenciales localmente.';
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
    $('preferencesStatus').textContent = 'Preferencias guardadas sólo en este navegador como preview. No modifican el modelo Quant.';
  }

  function blockCredentialSubmission(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.querySelector('input[type="password"]');
    if (password) password.value = '';
    $('authFormStatus').textContent = PRODUCT.authEnabled
      ? 'El adaptador de autenticación aún no está conectado en Fase 2A.'
      : 'Acceso bloqueado hasta configurar el proveedor de identidad gestionado. No se guardó ninguna contraseña.';
  }

  function init() {
    document.querySelectorAll('[data-auth-tab]').forEach((button) => {
      button.addEventListener('click', () => setAuthTab(button.dataset.authTab));
    });
    authForms().forEach((form) => form.addEventListener('submit', blockCredentialSubmission));
    $('preferencesForm')?.addEventListener('submit', savePreferences);
    $('prefProbability')?.addEventListener('input', () => {
      $('prefProbabilityValue').textContent = `${$('prefProbability').value}%`;
    });
    setAuthTab('login');
    renderProductState();
    loadPreferencesIntoForm();
    window.BTC_PRODUCT = PRODUCT;
  }

  window.addEventListener('DOMContentLoaded', init);
})();
