const $ = (id) => document.getElementById(id);

const CONFIG = Object.freeze({
  apiBase: (new URLSearchParams(location.search).get('api') || localStorage.getItem('btcModelApiBase') || 'https://btc-shadow-dashboard-api-o7li7xggnq-rj.a.run.app').replace(/\/$/, ''),
  trialId: 'btc-shadow-90d-20260817T173948Z',
  requiredDays: 90,
  modelVersion: 'V5.9.0-SPOT-HIGH-CONVICTION',
  marketSymbol: 'BTCUSDT',
  marketRefreshMs: 15000,
  modelRefreshMs: 30000,
  marketCandleLimit: 160,
});

const BASE_TRIAL = Object.freeze({
  trialId: CONFIG.trialId,
  requiredDays: CONFIG.requiredDays,
  completedDays: 0,
  firstCompleteDay: '2026-08-18',
  manifestDigest: '757422dbd20fead8503f0545766f06b5df020c78eab2bf036d72c5f72ef9fd03',
  status: 'INITIALIZED',
});

const chartState = { interval: '5m', candles: [], ticker: null };
let modelState = null;
let marketTimer = null;
let modelTimer = null;
let freshnessTimer = null;
let chartResizeObserver = null;
let chartResizeRaf = 0;
let visualViewportHandler = null;

function parseNum(value) {
  if (typeof value === 'number') return value;
  if (value == null || value === '') return NaN;
  return Number(String(value).replace(/%/g, '').replace(/\./g, '').replace(',', '.'));
}

function metricDecimal(value) {
  if (typeof value === 'number') return value;
  if (value == null || value === '') return NaN;
  const normalized = String(value).replace(',', '.');
  return Number(normalized);
}

function fmtUsd(value, digits = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(n) : '--';
}

function fmtTime(value) {
  if (!value) return '--';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleString('es-AR', { hour12: false }) : '--';
}

function fmtPct(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(digits)}%` : '--';
}

function timeAgo(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '--';
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h`;
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-store', signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function setClassText(id, text, className = '') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('goodText', 'warnText', 'badText');
  if (className) el.classList.add(className);
}

function setTrial(input) {
  const t = { ...BASE_TRIAL, ...(input || {}) };
  const req = Number(t.requiredDays) || 90;
  const validDone = Number.isFinite(Number(t.completedDays));
  const done = validDone ? Math.max(0, Math.min(req, Number(t.completedDays))) : 0;
  const pct = validDone && req ? (done / req) * 100 : 0;
  document.documentElement.style.setProperty('--trial-pct', `${pct}%`);
  $('trialCounter').textContent = validDone ? `${done} / ${req}` : `-- / ${req}`;
  $('trialPct').textContent = validDone ? `${pct.toFixed(pct < 10 ? 1 : 0)}%` : '--';
  $('trialDays').textContent = validDone ? `${done} de ${req}` : 'evidencia bloqueada';
  $('trialId').textContent = t.trialId || CONFIG.trialId;
  $('firstDay').textContent = t.firstCompleteDay || '--';
  const digest = t.manifestDigest || '';
  $('manifest').textContent = digest ? `${digest.slice(0, 10)}…${digest.slice(-6)}` : '--';
  $('trialState').textContent = `${t.status || 'UNKNOWN'}${validDone ? ` · ${done}/${req}` : ''}`;
  $('trialStatus').textContent = t.status === 'BLOCKED' || String(t.status).startsWith('BLOCKED')
    ? 'La continuidad formal no pudo validarse. El contador queda bloqueado y no avanza.'
    : 'Sólo cuentan días completos con evidencia fail-closed.';
  const isHealthy = !(t.status === 'BLOCKED' || String(t.status).startsWith('BLOCKED'));
  setClassText('trialHealth', isHealthy ? (t.status || 'INITIALIZED') : 'BLOCKED', isHealthy ? 'goodText' : 'badText');
}

async function loadTicker() {
  const data = await fetchJson(`https://api.binance.com/api/v3/ticker/24hr?symbol=${CONFIG.marketSymbol}`);
  chartState.ticker = data;
  $('price').textContent = fmtUsd(data.lastPrice);
  const change = Number(data.priceChangePercent);
  $('priceMeta').textContent = `24h ${change >= 0 ? '+' : ''}${change.toFixed(2)}% · Binance público`;
  setClassText('marketStatus', 'ONLINE', 'goodText');
  $('sideDot').className = 'dot ok';
  $('sideConn').textContent = 'Mercado público online';
  $('marketHigh').textContent = fmtUsd(data.highPrice);
  $('marketLow').textContent = fmtUsd(data.lowPrice);
  $('marketVolume').textContent = Number(data.quoteVolume) > 0 ? `${(Number(data.quoteVolume) / 1e6).toFixed(1)}M USDT` : '--';
}

async function loadCandles(interval = chartState.interval) {
  chartState.interval = interval;
  document.querySelectorAll('.tfButton').forEach((button) => button.classList.toggle('active', button.dataset.interval === interval));
  const rows = await fetchJson(`https://api.binance.com/api/v3/klines?symbol=${CONFIG.marketSymbol}&interval=${encodeURIComponent(interval)}&limit=${CONFIG.marketCandleLimit}`);
  chartState.candles = rows.map((r) => ({ time: Number(r[0]), open: Number(r[1]), high: Number(r[2]), low: Number(r[3]), close: Number(r[4]), volume: Number(r[5]) }));
  $('chartTf').textContent = interval;
  const last = chartState.candles.at(-1);
  if (last) {
    $('candleOpen').textContent = fmtUsd(last.open);
    $('candleHigh').textContent = fmtUsd(last.high);
    $('candleLow').textContent = fmtUsd(last.low);
    $('candleClose').textContent = fmtUsd(last.close);
  }
  scheduleChartDraw();
}

function chartViewportProfile(width, height) {
  let candleCount = 140;
  let gridLines = 5;
  let fontSize = 9;
  let rightPad = 64;

  if (width < 380) {
    candleCount = 42;
    gridLines = 3;
    fontSize = 8;
    rightPad = 58;
  } else if (width < 520) {
    candleCount = 54;
    gridLines = 4;
    fontSize = 8;
    rightPad = 60;
  } else if (width < 760) {
    candleCount = 68;
    gridLines = 4;
    fontSize = 8;
    rightPad = 62;
  } else if (width < 1024) {
    candleCount = 90;
    gridLines = 5;
    fontSize = 9;
    rightPad = 64;
  } else if (width < 1440) {
    candleCount = 120;
  }

  if (height < 235) gridLines = Math.min(gridLines, 3);
  return { candleCount, gridLines, fontSize, rightPad };
}

function drawChart() {
  const canvas = $('priceChart');
  if (!canvas || !chartState.candles.length) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  if (width < 40 || height < 40) return;

  const profile = chartViewportProfile(width, height);
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const pixelWidth = Math.max(1, Math.floor(width * dpr));
  const pixelHeight = Math.max(1, Math.floor(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = {
    top: width < 520 ? 21 : 24,
    right: profile.rightPad,
    bottom: width < 520 ? 18 : 24,
    left: width < 520 ? 7 : 12,
  };
  const plotW = Math.max(20, width - pad.left - pad.right);
  const plotH = Math.max(20, height - pad.top - pad.bottom);
  const candles = chartState.candles.slice(-profile.candleCount);
  const minPrice = Math.min(...candles.map((c) => c.low));
  const maxPrice = Math.max(...candles.map((c) => c.high));
  const span = Math.max(1, maxPrice - minPrice);
  const y = (p) => pad.top + ((maxPrice - p) / span) * plotH;
  const step = plotW / candles.length;
  const bodyW = Math.max(width < 380 ? 1.5 : 2, Math.min(8, step * 0.62));

  ctx.clearRect(0, 0, width, height);
  ctx.font = `${profile.fontSize}px system-ui`;
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= profile.gridLines; i += 1) {
    const gy = pad.top + (plotH / profile.gridLines) * i;
    const price = maxPrice - (span / profile.gridLines) * i;
    ctx.strokeStyle = 'rgba(42,74,108,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, gy);
    ctx.lineTo(width - pad.right, gy);
    ctx.stroke();
    ctx.fillStyle = '#7891ad';
    ctx.fillText(fmtUsd(price), width - pad.right + 6, gy);
  }

  candles.forEach((c, i) => {
    const x = pad.left + step * i + step / 2;
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? '#29d391' : '#ff6678';
    ctx.fillStyle = up ? '#29d391' : '#ff6678';
    ctx.beginPath();
    ctx.moveTo(x, y(c.high));
    ctx.lineTo(x, y(c.low));
    ctx.stroke();
    const top = Math.min(y(c.open), y(c.close));
    const candleHeight = Math.max(1, Math.abs(y(c.open) - y(c.close)));
    ctx.fillRect(x - bodyW / 2, top, bodyW, candleHeight);
  });

  const last = candles.at(-1);
  if (last) {
    const ly = y(last.close);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(88,168,255,.75)';
    ctx.beginPath();
    ctx.moveTo(pad.left, ly);
    ctx.lineTo(width - pad.right, ly);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function scheduleChartDraw() {
  if (chartResizeRaf) cancelAnimationFrame(chartResizeRaf);
  chartResizeRaf = requestAnimationFrame(() => {
    chartResizeRaf = 0;
    drawChart();
  });
}

function initResponsiveChart() {
  const wrap = document.querySelector('.chartWrap');
  if (wrap && 'ResizeObserver' in window) {
    chartResizeObserver = new ResizeObserver(() => scheduleChartDraw());
    chartResizeObserver.observe(wrap);
  }

  window.addEventListener('resize', scheduleChartDraw, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(scheduleChartDraw, 120), { passive: true });

  if (window.visualViewport) {
    visualViewportHandler = () => scheduleChartDraw();
    window.visualViewport.addEventListener('resize', visualViewportHandler, { passive: true });
  }
}

function decisionPill(value) {
  const d = String(value || '').toUpperCase();
  if (d.includes('NO_ACTUAR') || d.includes('ESPERAR')) return `<span class="pill no">${value || 'NO ACTUAR'}</span>`;
  if (d.includes('BUY') || d.includes('COMPR')) return `<span class="pill buy">${value}</span>`;
  return `<span class="pill block">${value || 'BLOQUEADA'}</span>`;
}

function setDecisionCard(tf, row) {
  const suffix = tf === '5m' ? '5' : '15';
  if (!row) {
    $(`d${suffix}`).textContent = 'Sin registro';
    $(`r${suffix}`).textContent = 'No se recibió una decisión oficial para este horizonte.';
    return;
  }
  $(`d${suffix}`).textContent = row.decision || '--';
  $(`r${suffix}`).textContent = row.reason || 'Sin motivo publicado';
  $(`a${suffix}`).textContent = row.activation || '--';
  $(`i${suffix}`).textContent = row.invalidation || '--';
  $(`q${suffix}`).textContent = row.signalQuality || '--';
  $(`ba${suffix}`).textContent = Number.isFinite(metricDecimal(row.balancedAccuracy)) ? metricDecimal(row.balancedAccuracy).toFixed(3) : '--';
  $(`bss${suffix}`).textContent = Number.isFinite(metricDecimal(row.brierSkillScore)) ? metricDecimal(row.brierSkillScore).toFixed(3) : '--';
  $(`ece${suffix}`).textContent = Number.isFinite(metricDecimal(row.ece)) ? metricDecimal(row.ece).toFixed(3) : '--';
}

function renderAnalytics(rows) {
  const eligible = rows.filter((x) => x.horizon === '5m' || x.horizon === '15m');
  const ba = eligible.map((x) => metricDecimal(x.balancedAccuracy)).filter(Number.isFinite);
  const ece = eligible.map((x) => metricDecimal(x.ece)).filter(Number.isFinite);
  const bss = eligible.map((x) => metricDecimal(x.brierSkillScore)).filter(Number.isFinite);
  const samples = eligible.map((x) => metricDecimal(x.evaluatedSamples)).filter(Number.isFinite);
  const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN;
  $('analyticsBA').textContent = Number.isFinite(avg(ba)) ? avg(ba).toFixed(3) : '--';
  $('analyticsECE').textContent = Number.isFinite(avg(ece)) ? avg(ece).toFixed(3) : '--';
  $('analyticsBSS').textContent = Number.isFinite(avg(bss)) ? avg(bss).toFixed(3) : '--';
  $('analyticsSamples').textContent = Number.isFinite(Math.max(...samples)) ? Math.max(...samples).toFixed(0) : '--';
  const blocked = eligible.filter((x) => String(x.executionViability || '').toUpperCase().includes('BLOQUE')).length;
  $('analyticsGate').textContent = eligible.length ? `${blocked}/${eligible.length} bloqueadas` : '--';
}

function renderDecisions(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const latest = (tf) => list.find((x) => x.horizon === tf);
  setDecisionCard('5m', latest('5m'));
  setDecisionCard('15m', latest('15m'));
  $('decisionSource').textContent = list.length ? 'motor live' : 'sin datos';
  $('decisionsBody').innerHTML = list.length ? list.slice(0, 15).map((x) => `
    <tr>
      <td>${fmtTime(x.timestamp)}</td><td>${x.horizon || '--'}</td><td>${decisionPill(x.decision)}</td>
      <td>${x.signalQuality || '--'}</td><td>${x.executionViability || '--'}</td><td>${x.modelState || '--'}</td>
      <td>${String(x.reason || '--').split(',').slice(0, 3).join(', ')}</td>
    </tr>`).join('') : '<tr><td colspan="7">Sin decisiones publicadas.</td></tr>';
  renderAnalytics(list);
}

function renderPaper(paper) {
  const p = paper || {};
  $('pTrades').textContent = p.simulatedTrades ?? 0;
  $('pWin').textContent = Number.isFinite(Number(p.winRatePct)) ? fmtPct(p.winRatePct) : '--';
  $('pPnl').textContent = Number.isFinite(Number(p.netPnlPct)) ? fmtPct(p.netPnlPct, 2) : '--';
  $('pDd').textContent = Number.isFinite(Number(p.drawdownPct)) ? fmtPct(p.drawdownPct, 2) : '--';
  if (p.note) $('paperNote').textContent = p.note;
  const trades = Array.isArray(p.trades) ? p.trades : [];
  $('tradesBody').innerHTML = trades.length ? trades.map((x) => `
    <tr><td>${fmtTime(x.closedAt || x.timestamp)}</td><td>${x.horizon || '--'}</td><td>${fmtUsd(x.entryPrice)}</td>
    <td>${fmtUsd(x.exitPrice)}</td><td>${x.result || '--'}</td><td>${Number.isFinite(Number(x.netPnlPct)) ? fmtPct(x.netPnlPct, 2) : '--'}</td><td>${x.evidenceRef || '--'}</td></tr>`).join('')
    : '<tr><td colspan="7">Sin trades simulados verificados publicados por la API.</td></tr>';
}

function updateFreshness() {
  const rt = modelState?.runtime;
  if (!rt?.lastSuccessfulCycleAt) {
    setClassText('dataFreshness', '--', 'warnText');
    $('freshnessDetail').textContent = 'sin ciclo verificable';
    return;
  }
  const ageSec = Math.max(0, Math.floor((Date.now() - Number(rt.lastSuccessfulCycleAt)) / 1000));
  const label = timeAgo(Number(rt.lastSuccessfulCycleAt));
  if (ageSec <= 180) {
    setClassText('dataFreshness', `FRESCO · ${label}`, 'goodText');
    $('freshnessDetail').textContent = 'último ciclo dentro de ventana';
  } else if (ageSec <= 600) {
    setClassText('dataFreshness', `DEMORA · ${label}`, 'warnText');
    $('freshnessDetail').textContent = 'ciclo más antiguo de lo esperado';
  } else {
    setClassText('dataFreshness', `STALE · ${label}`, 'badText');
    $('freshnessDetail').textContent = 'datos demasiado antiguos';
  }
}

async function loadModel() {
  try {
    const data = await fetchJson(`${CONFIG.apiBase}/api/v1/dashboard`, 14000);
    modelState = data;
    const rt = data.runtime || {};
    const ready = rt.ready === true && rt.shadowMode === true && rt.operationMode === 'SPOT_ONLY' && rt.allowShort === false;
    setClassText('engineState', ready ? 'ONLINE' : 'NOT READY', ready ? 'goodText' : 'badText');
    $('engineMeta').textContent = ready ? 'runtime validado' : 'fail-closed';
    setClassText('apiStatus', 'ONLINE', 'goodText');
    $('runtimeChip').className = `chip ${ready ? 'good' : 'bad'}`;
    $('runtimeChip').textContent = ready ? '● MOTOR ONLINE' : '● MOTOR NOT READY';
    $('runtimeText').textContent = `${rt.modelVersion || CONFIG.modelVersion} · ${rt.operationMode || '--'} · SHADOW=${rt.shadowMode === true ? 'true' : '--'}`;
    $('revision').textContent = rt.revision || '--';
    $('lastCycle').textContent = fmtTime(rt.lastSuccessfulCycleAt);
    $('errorState').textContent = rt.errorState || 'NONE';
    $('apiGenerated').textContent = fmtTime(data.generatedAt);
    $('systemRuntime').textContent = rt.revision || '--';
    $('systemApi').textContent = 'btc-shadow-dashboard-api-00002-6zb';
    $('systemMode').textContent = `${data.mode || '--'} / ${data.spotOnly ? 'SPOT_ONLY' : '--'}`;
    setTrial(data.trial);
    renderDecisions(data.decisions);
    renderPaper(data.paper);
    updateFreshness();
    $('sideDetail').textContent = 'Motor y trial servidos por API sanitizada sólo lectura.';
  } catch (error) {
    modelState = null;
    setClassText('engineState', 'SIN API', 'badText');
    $('engineMeta').textContent = 'fail-closed';
    setClassText('apiStatus', 'OFFLINE', 'badText');
    $('runtimeChip').className = 'chip bad';
    $('runtimeChip').textContent = '● API READ-ONLY OFFLINE';
    $('runtimeText').textContent = 'No se sustituyen datos faltantes. El dashboard queda fail-closed.';
    $('sideDetail').textContent = 'La API read-only no respondió. No se muestran datos inventados.';
    updateFreshness();
  }
}

async function refreshMarket() {
  try {
    await Promise.all([loadTicker(), loadCandles(chartState.interval)]);
  } catch (error) {
    setClassText('marketStatus', 'OFFLINE', 'badText');
    $('priceMeta').textContent = 'Mercado público no disponible';
    $('sideDot').className = 'dot bad';
    $('sideConn').textContent = 'Mercado sin conexión';
  }
}

async function refreshAll() {
  $('refresh').disabled = true;
  $('refresh').textContent = 'Actualizando…';
  await Promise.allSettled([refreshMarket(), loadModel()]);
  $('refresh').disabled = false;
  $('refresh').textContent = '↻ Actualizar';
}

function selectView(name) {
  document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.id === name));
  document.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (name === 'overview') setTimeout(scheduleChartDraw, 0);
}

function initNavigation() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => selectView(button.dataset.view)));
  document.querySelectorAll('.tfButton').forEach((button) => button.addEventListener('click', async () => {
    try { await loadCandles(button.dataset.interval); } catch { setClassText('marketStatus', 'ERROR VELAS', 'warnText'); }
  }));
  $('refresh').addEventListener('click', refreshAll);
}

function init() {
  initNavigation();
  initResponsiveChart();
  setTrial(BASE_TRIAL);
  refreshAll();
  marketTimer = setInterval(loadTicker, CONFIG.marketRefreshMs);
  modelTimer = setInterval(loadModel, CONFIG.modelRefreshMs);
  freshnessTimer = setInterval(updateFreshness, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      refreshAll();
      scheduleChartDraw();
    }
  });
}

window.addEventListener('DOMContentLoaded', init);
