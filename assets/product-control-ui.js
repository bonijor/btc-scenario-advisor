import { createFirebaseAuthAdapter } from './firebase-auth.js';

const API_BASE = 'https://btc-product-control-531376347818.southamerica-east1.run.app';
const $ = (id) => document.getElementById(id);
let state = { loading: true, online: false, me: null, error: null };

function ensureStyles() {
  if (document.querySelector('link[data-product-control-ui]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/product-control-ui.css?v=4c1';
  link.dataset.productControlUi = 'true';
  document.head.append(link);
}

function shell() {
  const card = document.querySelector('#account .membershipCard');
  if (!card) return null;
  if (!$('productControlPanel')) {
    card.innerHTML = `
      <div class="ey">Plan y alertas</div>
      <div class="productControlHead"><div><h3>Scenario Advisor PRO</h3><p class="tiny">Tu plan habilita producto y notificaciones, nunca autoridad sobre el motor Quant.</p></div><span class="chip" id="productControlStatus">CONECTANDO</span></div>
      <div class="membershipGrid" id="productPlans">
        <div class="planCard"><strong>FREE</strong><small>Dashboard, análisis probabilístico, trial 90D y lectura de mercado.</small></div>
        <div class="planCard recommended"><strong>PRO mensual</strong><small>Alertas, canales personales, historial ampliado y herramientas de research a medida que sean validadas.</small></div>
      </div>
      <div id="productControlPanel" class="productControlPanel" aria-live="polite"></div>
      <div class="planAuthorityNote"><b>Separación Quant:</b> una membresía nunca puede cambiar el modelo, sus umbrales, habilitar órdenes ni convertir una señal bloqueada en operación.</div>
    `;
  }
  return $('productControlPanel');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

async function authFetch(path, options = {}) {
  const adapter = await createFirebaseAuthAdapter();
  const token = await adapter.getIdToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP_${response.status}`);
  return body;
}

function renderOffline(panel) {
  $('productControlStatus').textContent = 'SIN CONEXIÓN';
  $('productControlStatus').className = 'chip warn';
  panel.innerHTML = '<div class="bannerNote"><b>Plan no sincronizado.</b> No pudimos conectar con Product Control. El dashboard sigue disponible, pero no mostramos un estado de membresía que no podamos verificar.</div>';
}

function renderAnonymous(panel) {
  $('productControlStatus').textContent = state.online ? 'DISPONIBLE' : 'SIN CONEXIÓN';
  $('productControlStatus').className = `chip ${state.online ? 'good' : 'warn'}`;
  panel.innerHTML = '<div class="bannerNote">Iniciá sesión para ver tu plan, configurar alertas y administrar tus canales personales.</div>';
}

function renderMe(panel, me) {
  const ent = me.entitlement || { plan: 'free', status: 'inactive' };
  const caps = me.capabilities || {};
  const pro = String(ent.plan || '').toLowerCase() === 'pro' && String(ent.status || '').toLowerCase() === 'authorized';
  const whatsapp = me.contact?.whatsapp || '';
  $('productControlStatus').textContent = pro ? 'PRO ACTIVO' : 'FREE';
  $('productControlStatus').className = `chip ${pro ? 'good' : ''}`;
  panel.innerHTML = `
    <div class="productControlGrid">
      <div class="productControlStat"><span>Plan</span><strong>${escapeHtml(pro ? 'PRO' : 'FREE')}</strong><small>${escapeHtml(ent.status || 'inactive')}</small></div>
      <div class="productControlStat"><span>Alertas por email</span><strong>${caps.alertEmail ? 'HABILITADAS' : 'NO ACTIVAS'}</strong><small>${escapeHtml(me.email || 'sin email')}</small></div>
      <div class="productControlStat"><span>Alertas por WhatsApp</span><strong>${caps.alertWhatsapp ? 'HABILITADAS' : 'NO ACTIVAS'}</strong><small>${whatsapp ? `••• ${escapeHtml(whatsapp.slice(-4))}` : 'sin número'}</small></div>
    </div>
    <div class="productActions">
      ${!pro && caps.membershipCheckout ? '<button class="btn primary" id="startProCheckout" type="button">Activar PRO mensual</button>' : ''}
      <button class="btn" id="refreshProductControl" type="button">Sincronizar plan</button>
    </div>
    <form id="whatsappContactForm" class="productContactForm">
      <label for="productWhatsapp">WhatsApp para alertas</label>
      <div class="productContactRow"><input id="productWhatsapp" type="tel" autocomplete="tel" placeholder="+54 9 351 ..." value=""><button class="btn" type="submit">Guardar</button></div>
      <small>Se almacena en el backend privado. Tus preferencias definen qué alertas querés recibir; no modifican los criterios del motor.</small>
      <p class="tiny" id="productContactStatus"></p>
    </form>
  `;
  $('startProCheckout')?.addEventListener('click', startCheckout);
  $('refreshProductControl')?.addEventListener('click', refresh);
  $('whatsappContactForm')?.addEventListener('submit', saveContact);
}

async function health() {
  try {
    const response = await fetch(`${API_BASE}/healthz`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const body = await response.json();
    return body.ok === true && body.quantMutationAllowed === false && body.tradingExecutionAllowed === false;
  } catch { return false; }
}

async function refresh() {
  const panel = shell();
  if (!panel) return;
  state.loading = true;
  panel.innerHTML = '<div class="bannerNote">Sincronizando plan y canales…</div>';
  state.online = await health();
  if (!state.online) {
    state.loading = false;
    state.me = null;
    renderOffline(panel);
    return;
  }
  const adapter = await createFirebaseAuthAdapter();
  if (!adapter.getCurrentUser()) {
    state.loading = false;
    state.me = null;
    renderAnonymous(panel);
    return;
  }
  try {
    state.me = await authFetch('/api/v1/me');
    state.error = null;
    renderMe(panel, state.me);
  } catch (error) {
    state.error = error;
    panel.innerHTML = '<div class="bannerNote">No pudimos verificar el plan con Product Control. La interfaz no asumirá FREE ni PRO hasta recuperar una respuesta válida.</div>';
  } finally { state.loading = false; }
}

async function startCheckout() {
  const button = $('startProCheckout');
  if (button) { button.disabled = true; button.textContent = 'Preparando checkout…'; }
  try {
    const checkout = await authFetch('/api/v1/membership/checkout', { method: 'POST', body: '{}' });
    if (!/^https:\/\//.test(String(checkout.checkoutUrl || ''))) throw new Error('CHECKOUT_URL_INVALID');
    location.assign(checkout.checkoutUrl);
  } catch {
    if (button) { button.disabled = false; button.textContent = 'Activar PRO mensual'; }
    const panel = $('productControlPanel');
    panel?.insertAdjacentHTML('afterbegin', '<div class="bannerNote">No se pudo iniciar el checkout. La membresía no cambió.</div>');
  }
}

async function saveContact(event) {
  event.preventDefault();
  const input = $('productWhatsapp');
  const status = $('productContactStatus');
  const whatsapp = String(input?.value || '').trim();
  if (!whatsapp) { if (status) status.textContent = 'Ingresá un número con código de país.'; return; }
  if (status) status.textContent = 'Guardando…';
  try {
    const result = await authFetch('/api/v1/contact', { method: 'POST', body: JSON.stringify({ whatsapp }) });
    if (status) status.textContent = `WhatsApp guardado: ${result.whatsappMasked || 'OK'}.`;
    await refresh();
  } catch { if (status) status.textContent = 'No pudimos guardar el WhatsApp. Revisá el formato e intentá nuevamente.'; }
}

ensureStyles();
shell();
refresh();
const api = Object.freeze({ refresh, apiBase: API_BASE });
window.BTC_PRODUCT_CONTROL_UI = api;
window.SCENARIO_PRODUCT_CONTROL_UI = api;
