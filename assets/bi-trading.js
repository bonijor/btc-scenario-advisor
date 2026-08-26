import { createFirebaseAuthAdapter } from './firebase-auth.js';

const API_BASE = 'https://btc-shadow-dashboard-api-o7li7xggnq-rj.a.run.app';
const MARKET_URL = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
const REQUIRED_DAYS = 90;
const MODEL_VERSION = 'V5.9.0-SPOT-HIGH-CONVICTION';
const HORIZON_ORDER = ['1m', '5m', '15m', '45m', '1d'];

const $ = (id) => document.getElementById(id);
let authAdapter = null;
let refreshTimer = null;

function text(id, value) {
  const node = $(id);
  if (node) node.textContent = value == null || value === '' ? '--' : String(value);
}

function classText(id, value, tone = '') {
  const node = $(id);
  if (!node) return;
  node.textContent = value == null || value === '' ? '--' : String(value);
  node.classList.remove('goodText', 'warnText', 'badText');
  if (tone) node.classList.add(tone);
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null || value === '') return NaN;
  const cleaned = String(value).trim().replace(/\s/g, '').replace(/%$/, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function decimal(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value == null || value === '') return NaN;
  const n = Number(String(value).replace(',', '.').replace('%', ''));
  return Number.isFinite(n) ? n : NaN;
}

function pct(value, digits = 1, alreadyPercent = false) {
  const n = decimal(value);
  if (!Number.isFinite(n)) return '--';
  const p = alreadyPercent ? n : Math.abs(n) <= 1 ? n * 100 : n;
  return `${p.toFixed(digits)}%`;
}

function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
}

function when(value) {
  if (!value) return '--';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('es-AR', { hour12: false }) : '--';
}

function age(value) {
  if (!value) return '--';
  const d = new Date(Number(value) || value);
  if (!Number.isFinite(d.getTime())) return '--';
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `hace ${s}s`;
  if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
  return `hace ${Math.floor(s / 3600)}h`;
}

function esc(value) {
  return String(value ?? '--').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function decisionTone(value) {
  const d = String(value || '').toUpperCase();
  if (/BUY|COMPR|ELEGIBLE/.test(d) && !/NO_|NO ACTUAR|BLOQUE/.test(d)) return 'good';
  if (/NO_ACTUAR|NO ACTUAR|ESPERAR|WAIT|MONITOREAR|PROTEGER/.test(d)) return 'warn';
  if (/BLOCK|BLOQUE|ERROR|SELL|SHORT/.test(d)) return 'bad';
  return '';
}

function field(row, ...names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null && row?.[name] !== '') return row[name];
  }
  return null;
}

function dominantProbability(row) {
  const direct = field(row, 'dominantProbability', 'probabilityDominant', 'probability', 'confidenceScore', 'confidencePct');
  const n = decimal(direct);
  if (Number.isFinite(n)) return Math.abs(n) <= 1 ? n * 100 : n;
  const candidates = [field(row, 'upProbability', 'pUp', 'probUp'), field(row, 'downProbability', 'pDown', 'probDown'), field(row, 'sidewaysProbability', 'pSideways', 'probSideways')]
    .map(decimal).filter(Number.isFinite).map((v) => Math.abs(v) <= 1 ? v * 100 : v);
  return candidates.length ? Math.max(...candidates) : NaN;
}

function biasOf(row) {
  return String(field(row, 'bias', 'scenario', 'direction', 'dominantScenario') || '').replaceAll('_', ' ').trim();
}

function currentUserLabel(user) {
  return user?.displayName || user?.email || 'sesión activa';
}

function setRail(ok, label) {
  const dot = $('railDot');
  if (dot) dot.className = `statusDot ${ok === true ? 'good' : ok === false ? 'bad' : ''}`;
  text('railStatus', label);
}

async function getAuthAdapter() {
  if (authAdapter) return authAdapter;
  authAdapter = await createFirebaseAuthAdapter();
  return authAdapter;
}

async function waitForUser(adapter, timeoutMs = 2500) {
  const immediate = adapter.getCurrentUser();
  if (immediate) return immediate;
  return await new Promise((resolve) => {
    let done = false;
    const stop = adapter.subscribe((user) => {
      if (done || !user) return;
      done = true;
      stop();
      resolve(user);
    });
    setTimeout(() => {
      if (done) return;
      done = true;
      stop();
      resolve(adapter.getCurrentUser());
    }, timeoutMs);
  });
}

async function dashboardRequest() {
  const adapter = await getAuthAdapter();
  const user = await waitForUser(adapter);
  if (!user) {
    const err = new Error('SESSION_REQUIRED');
    err.code = 'SESSION_REQUIRED';
    throw err;
  }
  const token = await adapter.getIdToken(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(`${API_BASE}/api/v1/dashboard?bi=1&t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'x-btc-dashboard-authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) throw new Error(`API_HTTP_${response.status}`);
    const data = await response.json();
    return { data, user };
  } finally {
    clearTimeout(timer);
  }
}

async function marketRequest() {
  const response = await fetch(`${MARKET_URL}&t=${Date.now()}`, { cache: 'no-store', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`MARKET_HTTP_${response.status}`);
  return await response.json();
}

function safeRuntime(data) {
  const rt = data?.runtime || {};
  return data?.apiVersion === 'btc-shadow-dashboard-readonly/2.1'
    && data?.mode === 'SHADOW'
    && data?.spotOnly === true
    && data?.automaticExecution === false
    && rt.ready === true
    && rt.shadowMode === true
    && rt.operationMode === 'SPOT_ONLY'
    && rt.allowShort === false;
}

function renderMarket(market) {
  if (!market) {
    classText('marketState', 'OFFLINE', 'badText');
    text('btcPrice', 'No disponible');
    text('priceChange', '24h --');
    return;
  }
  const price = Number(market.lastPrice);
  const change = Number(market.priceChangePercent);
  text('btcPrice', usd(price));
  const changeLabel = Number.isFinite(change) ? `24h ${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '24h --';
  const changeNode = $('priceChange');
  if (changeNode) {
    changeNode.textContent = changeLabel;
    changeNode.className = `pill ${change > 0 ? 'good' : change < 0 ? 'bad' : 'neutral'}`;
  }
  classText('marketState', 'ONLINE', 'goodText');
  text('marketUpdated', `Binance público · ${new Date().toLocaleTimeString('es-AR', { hour12: false })}`);
}

function renderExecutive(data) {
  const rows = Array.isArray(data?.decisions) ? data.decisions : [];
  const operational = ['5m', '15m'].map((h) => rows.find((r) => r.horizon === h)).filter(Boolean);
  const biases = operational.map(biasOf).filter(Boolean);
  let bias = 'SIN SESGO PUBLICADO';
  if (biases.length === 2 && biases[0].toLowerCase() === biases[1].toLowerCase()) bias = biases[0];
  else if (biases.length) bias = biases.join(' / ');
  text('executiveBias', bias);

  const probs = operational.map(dominantProbability).filter(Number.isFinite);
  const confidence = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : NaN;
  text('globalConfidence', Number.isFinite(confidence) ? `${confidence.toFixed(1)}%` : 'NO PUBLICADA');
  const pulse = $('pulseBar');
  if (pulse) pulse.style.width = `${Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0}%`;

  const qualities = operational.map((r) => String(r.signalQuality || '')).filter(Boolean);
  text('globalQuality', qualities.length ? [...new Set(qualities)].join(' / ') : 'NO PUBLICADA');
  text('modelName', data?.runtime?.modelVersion || MODEL_VERSION);
}

function renderTrial(trial) {
  const required = Number(trial?.requiredDays) || REQUIRED_DAYS;
  const done = Number(trial?.completedDays);
  const valid = Number.isFinite(done);
  const pctValue = valid && required > 0 ? Math.max(0, Math.min(100, done / required * 100)) : 0;
  const remaining = valid ? Math.max(0, required - done) : null;
  text('trialState', valid ? `${done} / ${required}` : `-- / ${required}`);
  text('trialStatus', trial?.status || 'UNAVAILABLE');
  text('trialPct', valid ? `${pctValue.toFixed(pctValue < 10 ? 1 : 0)}%` : '--%');
  text('trialDays', valid ? `${done} de ${required}` : `-- de ${required}`);
  text('trialRemaining', remaining == null ? '-- días restantes' : `${remaining} días restantes`);
  text('trialRange', trial?.firstCompleteDay && trial?.lastCompleteDay ? `${trial.firstCompleteDay} → ${trial.lastCompleteDay}` : 'Continuidad formal no publicada');
  text('trialId', trial?.trialId || 'btc-shadow-90d-20260817T173948Z');
  const ring = $('trialRing');
  if (ring) ring.style.setProperty('--trial-pct', `${pctValue}%`);
  const badge = $('trialBadge');
  if (badge) {
    badge.textContent = trial?.status || 'UNAVAILABLE';
    badge.className = `pill ${trial?.status === 'VERIFIED' ? 'good' : String(trial?.status || '').startsWith('BLOCKED') ? 'bad' : 'warn'}`;
  }
}

function renderSafety(data) {
  const rt = data?.runtime || {};
  const paperSafety = data?.paper?.safety || {};
  const shadowOk = data?.mode === 'SHADOW' && rt.shadowMode === true;
  const spotOk = data?.spotOnly === true && rt.operationMode === 'SPOT_ONLY';
  const shortOk = rt.allowShort === false;
  const ordersOk = data?.automaticExecution === false && paperSafety.realOrderCreated !== true && paperSafety.exchangeOrderRequestMade !== true;
  classText('shadowGuard', shadowOk ? 'PASS' : 'FAIL', shadowOk ? 'goodText' : 'badText');
  classText('spotGuard', spotOk ? 'PASS' : 'FAIL', spotOk ? 'goodText' : 'badText');
  classText('shortGuard', shortOk ? 'BLOQUEADOS' : 'REVISAR', shortOk ? 'goodText' : 'badText');
  classText('ordersGuard', ordersOk ? '0 / BLOQUEADAS' : 'REVISAR', ordersOk ? 'goodText' : 'badText');
  classText('safetyState', shadowOk && spotOk && shortOk && ordersOk ? 'SHADOW PASS' : 'SAFETY FAIL', shadowOk && spotOk && shortOk && ordersOk ? 'goodText' : 'badText');
}

function renderScenarios(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ordered = [...list].sort((a, b) => HORIZON_ORDER.indexOf(a.horizon) - HORIZON_ORDER.indexOf(b.horizon));
  const body = $('scenarioRows');
  if (!body) return;
  if (!ordered.length) {
    body.innerHTML = '<tr><td colspan="10">La API no publicó decisiones para esta lectura.</td></tr>';
    return;
  }
  body.innerHTML = ordered.map((row) => {
    const d = String(row.decision || '--').replaceAll('_', ' ');
    const tone = decisionTone(d);
    return `<tr>
      <td class="nowrap"><b>${esc(row.horizon)}</b>${row.horizon === '5m' || row.horizon === '15m' ? ' · operativo' : ' · contexto'}</td>
      <td>${esc(biasOf(row) || '--')}</td>
      <td><span class="decisionLabel ${tone}">${esc(d)}</span></td>
      <td>${esc(row.signalQuality || '--')}</td>
      <td>${esc(row.executionViability || '--')}</td>
      <td>${esc(pct(row.balancedAccuracy, 1))}</td>
      <td>${esc(pct(row.brier, 1))}</td>
      <td>${esc(pct(row.ece, 1))}</td>
      <td>${esc(row.activation || '--')}</td>
      <td>${esc(row.invalidation || '--')}</td>
    </tr>`;
  }).join('');
}

function renderCalibration(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const grid = $('calibrationGrid');
  if (!grid) return;
  const ordered = HORIZON_ORDER.map((h) => list.find((r) => r.horizon === h)).filter(Boolean);
  if (!ordered.length) {
    grid.innerHTML = '<article class="panel calibrationCard"><span>Sin métricas</span><strong>--</strong><small>La API no publicó calibración.</small></article>';
    return;
  }
  grid.innerHTML = ordered.map((row) => {
    const ba = decimal(row.balancedAccuracy);
    const baPct = Number.isFinite(ba) ? (Math.abs(ba) <= 1 ? ba * 100 : ba) : NaN;
    const state = row.modelState || 'Estado no publicado';
    return `<article class="panel calibrationCard">
      <span>${esc(row.horizon)}</span>
      <strong>${esc(Number.isFinite(baPct) ? `${baPct.toFixed(1)}% BA` : 'BA --')}</strong>
      <small>Brier ${esc(pct(row.brier, 1))} · ECE ${esc(pct(row.ece, 1))}<br>${esc(state)}</small>
      <div class="meter"><i style="width:${Number.isFinite(baPct) ? Math.max(0, Math.min(100, baPct)) : 0}%"></i></div>
    </article>`;
  }).join('');
}

function renderPaper(paper) {
  const trades = Array.isArray(paper?.trades) ? paper.trades : [];
  const count = Number.isFinite(Number(paper?.simulatedTrades)) ? Number(paper.simulatedTrades) : trades.length;
  text('paperTrades', count);
  text('paperWin', Number.isFinite(Number(paper?.winRatePct)) ? `${Number(paper.winRatePct).toFixed(1)}%` : '--');
  text('paperPnl', Number.isFinite(Number(paper?.netPnlPct)) ? `${Number(paper.netPnlPct).toFixed(2)}%` : '--');
  text('paperDd', Number.isFinite(Number(paper?.drawdownPct)) ? `${Number(paper.drawdownPct).toFixed(2)}%` : '--');
  text('paperNote', paper?.note || 'Las abstenciones no son trades. El BI sólo publica resultados simulados verificables.');
  const badge = $('paperBadge');
  if (badge) {
    badge.textContent = paper?.status || 'UNAVAILABLE';
    badge.className = `pill ${paper?.status === 'WAITING_CONDITIONS' ? 'warn' : paper?.status === 'BLOCKED' ? 'bad' : ''}`;
  }

  const diagnostics = Array.isArray(paper?.funnel?.diagnostics) ? paper.funnel.diagnostics.filter((d) => d.horizon === '5m' || d.horizon === '15m') : [];
  const list = $('distanceList');
  if (!list) return;
  if (!diagnostics.length) {
    list.innerHTML = '<div class="empty">Sin diagnóstico Distance to Eligible publicado todavía.</div>';
    return;
  }
  list.innerHTML = diagnostics.map((d) => {
    const remaining = d.remainingChecks ?? (Array.isArray(d.failedCheckIds) ? d.failedCheckIds.length : '--');
    const progress = Number(d.progressPct);
    return `<div class="distanceItem">
      <div class="distanceTop"><b>BTC ${esc(d.horizon)}</b><span>${d.eligible ? 'ELIGIBLE' : `${esc(remaining)} pendientes`}</span></div>
      <small>${esc(d.firstFailureReason || d.firstFailureStage || 'Sin bloqueo principal publicado')} · ${Number.isFinite(progress) ? `${progress.toFixed(0)}%` : '--'} del funnel</small>
    </div>`;
  }).join('');
}

function renderSystem(data) {
  const rt = data?.runtime || {};
  const ready = safeRuntime(data);
  classText('runtimeReady', ready ? 'READY' : 'NOT READY', ready ? 'goodText' : 'badText');
  text('runtimeRevision', rt.revision || '--');
  text('lastCycle', when(rt.lastSuccessfulCycleAt));
  text('cycleAge', age(rt.lastSuccessfulCycleAt));
  classText('errorState', rt.errorState || 'NONE', rt.errorState ? 'badText' : 'goodText');
  text('contractState', data?.apiVersion || '--');
  text('generatedAt', when(data?.generatedAt));
  classText('apiState', ready ? 'ONLINE' : 'NOT READY', ready ? 'goodText' : 'badText');
  text('apiVersion', data?.apiVersion || '--');
  setRail(ready, ready ? 'BI online' : 'BI fail-closed');
}

function renderDashboard(data, user) {
  renderExecutive(data);
  renderTrial(data?.trial || {});
  renderSafety(data);
  renderScenarios(data?.decisions);
  renderCalibration(data?.decisions);
  renderPaper(data?.paper || {});
  renderSystem(data);
  const detail = user ? `Sesión: ${currentUserLabel(user)}` : 'Sesión no disponible';
  const rail = document.querySelector('.railFoot small');
  if (rail) rail.textContent = `${detail} · read-only`;
}

function renderApiFailure(error) {
  const session = error?.code === 'SESSION_REQUIRED' || error?.message === 'SESSION_REQUIRED';
  classText('apiState', session ? 'SESIÓN REQUERIDA' : 'OFFLINE', 'badText');
  text('apiVersion', session ? 'Ingresá desde Dashboard → Cuenta' : 'fail-closed');
  setRail(false, session ? 'Sesión requerida' : 'BI offline');
  const body = $('scenarioRows');
  if (body) body.innerHTML = `<tr><td colspan="10">${session ? 'Iniciá sesión en el Dashboard y volvé a abrir BI Trading.' : 'API read-only no disponible. No se muestran valores aproximados.'}</td></tr>`;
}

async function refresh() {
  const button = $('refreshBi');
  if (button) { button.disabled = true; button.textContent = 'Actualizando…'; }
  const [dashboard, market] = await Promise.allSettled([dashboardRequest(), marketRequest()]);
  if (dashboard.status === 'fulfilled') renderDashboard(dashboard.value.data, dashboard.value.user);
  else renderApiFailure(dashboard.reason);
  if (market.status === 'fulfilled') renderMarket(market.value);
  else renderMarket(null);
  if (button) { button.disabled = false; button.textContent = '↻ Actualizar'; }
}

function init() {
  $('refreshBi')?.addEventListener('click', refresh);
  refresh();
  refreshTimer = setInterval(refresh, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('beforeunload', () => { if (refreshTimer) clearInterval(refreshTimer); }, { once: true });
}

window.addEventListener('DOMContentLoaded', init);
