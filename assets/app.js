const $ = (id) => document.getElementById(id);
const funnelEl = (id) => document.getElementById(id);

const CONFIG = Object.freeze({
  apiBase: (new URLSearchParams(location.search).get('api') || localStorage.getItem('btcModelApiBase') || 'https://btc-shadow-dashboard-api-o7li7xggnq-rj.a.run.app').replace(/\/$/, ''),
  trialId: 'btc-shadow-90d-20260817T173948Z',
  requiredDays: 90,
  modelVersion: 'V5.9.0-SPOT-HIGH-CONVICTION',
  marketSymbol: 'BTCUSDT',
  marketRefreshMs: 15000,
  modelRefreshMs: 30000,
  marketCandleLimit: 160,
  verifiedSnapshotKey: 'btcScenarioDashboardVerifiedV2',
});

const BASE_TRIAL = Object.freeze({
  trialId: CONFIG.trialId,
  requiredDays: CONFIG.requiredDays,
  completedDays: null,
  firstCompleteDay: '2026-08-18',
  manifestDigest: '757422dbd20fead8503f0545766f06b5df020c78eab2bf036d72c5f72ef9fd03',
  status: 'UNAVAILABLE',
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

function setTrial(input, { stale = false } = {}) {
  const t = { ...BASE_TRIAL, ...(input || {}) };
  const req = Number(t.requiredDays) || CONFIG.requiredDays;
  const hasCompletedDays = t.completedDays !== null && t.completedDays !== undefined && t.completedDays !== '';
  const validDone = hasCompletedDays && Number.isFinite(Number(t.completedDays));
  const done = validDone ? Math.max(0, Math.min(req, Number(t.completedDays))) : null;
  const pct = validDone && req ? (done / req) * 100 : 0;
  document.documentElement.style.setProperty('--trial-pct', `${pct}%`);
  $('trialCounter').textContent = validDone ? `${done} / ${req}` : `-- / ${req}`;
  $('trialPct').textContent = validDone ? `${pct.toFixed(pct < 10 ? 1 : 0)}%` : '--';
  $('trialDays').textContent = validDone ? `${done} de ${req}` : 'evidencia no disponible';
  $('trialId').textContent = t.trialId || CONFIG.trialId;
  $('firstDay').textContent = t.firstCompleteDay || '--';
  const digest = t.manifestDigest || '';
  $('manifest').textContent = digest ? `${digest.slice(0, 10)}…${digest.slice(-6)}` : '--';
  const status = t.status || 'UNKNOWN';
  $('trialState').textContent = `${status}${validDone ? ` · ${done}/${req}` : ''}${stale ? ' · SNAPSHOT' : ''}`;
  if (stale) {
    $('trialStatus').textContent = 'Mostrando el último snapshot verificado. La API está temporalmente fuera de línea; el contador no se reinicia.';
  } else if (status === 'UNAVAILABLE') {
    $('trialStatus').textContent = 'La API todavía no respondió y no hay un snapshot verificado local.';
  } else if (status === 'BLOCKED' || String(status).startsWith('BLOCKED')) {
    $('trialStatus').textContent = 'La continuidad formal no pudo validarse. El contador queda bloqueado y no avanza.';
  } else {
    $('trialStatus').textContent = 'Sólo cuentan días completos con evidencia fail-closed.';
  }
  const blocked = status === 'BLOCKED' || String(status).startsWith('BLOCKED');
  const className = blocked ? 'badText' : stale || status === 'UNAVAILABLE' ? 'warnText' : 'goodText';
  const healthLabel = stale ? `${status} · SNAPSHOT` : blocked ? 'BLOCKED' : status;
  setClassText('trialHealth', healthLabel, className);
}

function snapshotIsSafe(data) {
  if (!data || typeof data !== 'object') return false;
  const rt = data.runtime || {};
  const trial = data.trial || {};
  return data.mode === 'SHADOW'
    && data.spotOnly === true
    && data.automaticExecution === false
    && rt.shadowMode === true
    && rt.operationMode === 'SPOT_ONLY'
    && rt.allowShort === false
    && trial.trialId === CONFIG.trialId
    && Number.isFinite(Number(trial.completedDays))
    && Number(trial.completedDays) >= 0
    && Number(trial.completedDays) <= CONFIG.requiredDays;
}

function saveVerifiedSnapshot(data) {
  if (!snapshotIsSafe(data)) return;
  try {
    localStorage.setItem(CONFIG.verifiedSnapshotKey, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Resilience cache is best effort only.
  }
}

function readVerifiedSnapshot() {
  try {
    const cached = JSON.parse(localStorage.getItem(CONFIG.verifiedSnapshotKey) || 'null');
    return cached && snapshotIsSafe(cached.data) ? cached.data : null;
  } catch {
    return null;
  }
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
  $('analyticsSamples').textContent = samples.length ? Math.max(...samples).toFixed(0) : '--';
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

function ensureFunnelUi() {
  if (funnelEl('paperFunnelPanel')) return;
  const lowerGrid = document.querySelector('#overview .lowerGrid');
  if (!lowerGrid) return;
  lowerGrid.insertAdjacentHTML('afterend', `
    <article class="panel content" id="paperFunnelPanel" style="margin-top:10px">
      <div class="head"><div><div class="ey">Embudo de elegibilidad</div><h3>De observación a señal Paper elegible</h3></div><span class="chip" id="funnelStatus">sin datos</span></div>
      <p class="tiny">Cada etapa muestra cuántas observaciones siguen vivas después de aplicar los filtros del motor. Cero elegibles no significa cero datos.</p>
      <div class="analyticsGrid">
        <div class="analyticsCard"><span>Observadas</span><strong id="funnelObserved">--</strong></div>
        <div class="analyticsCard"><span>Horizonte oficial</span><strong id="funnelOfficial">--</strong></div>
        <div class="analyticsCard"><span>Sesgo bullish</span><strong id="funnelBullish">--</strong></div>
        <div class="analyticsCard"><span>Alta confianza</span><strong id="funnelConfidence">--</strong></div>
        <div class="analyticsCard"><span>Elegibles</span><strong id="funnelEligible">--</strong></div>
      </div>
      <div class="bannerNote" id="funnelReasons">Esperando evidencia del funnel.</div>
    </article>
  `);
}

function renderFunnel(funnel) {
  ensureFunnelUi();
  const f = funnel && typeof funnel === 'object' ? funnel : null;
  if (!f) {
    ['funnelObserved', 'funnelOfficial', 'funnelBullish', 'funnelConfidence', 'funnelEligible'].forEach((id) => {
      const el = funnelEl(id);
      if (el) el.textContent = '--';
    });
    if (funnelEl('funnelStatus')) funnelEl('funnelStatus').textContent = 'sin datos';
    if (funnelEl('funnelReasons')) funnelEl('funnelReasons').textContent = 'Esperando evidencia del funnel.';
    return;
  }
  const counts = f.counts || {};
  const value = (key) => Number.isFinite(Number(counts[key])) ? String(Number(counts[key])) : '--';
  funnelEl('funnelObserved').textContent = value('observed');
  funnelEl('funnelOfficial').textContent = value('officialHorizon');
  funnelEl('funnelBullish').textContent = value('bullishBias');
  funnelEl('funnelConfidence').textContent = value('highConfidence');
  funnelEl('funnelEligible').textContent = value('eligible');
  funnelEl('funnelStatus').textContent = `protocolo ${f.protocol || 'read-only'}`;
  const rejected = f.rejectedByReason && typeof f.rejectedByReason === 'object' ? Object.entries(f.rejectedByReason) : [];
  const lifecycle = f.lifecycle || {};
  const rejectionText = rejected.length
    ? rejected.map(([reason, count]) => `${reason}: ${count}`).join(' · ')
    : 'Sin rechazos publicados.';
  funnelEl('funnelReasons').textContent = `${rejectionText} · abiertas: ${Number(lifecycle.opened || 0)} · verificadas: ${Number(lifecycle.verified || 0)}`;
}

function normalizedPaperPayload(payload) {
  const root = payload && typeof payload === 'object' ? payload : {};
  const book = root.paper && typeof root.paper === 'object' ? root.paper : root;
  const metrics = book.metrics && typeof book.metrics === 'object' ? book.metrics : {};
  const trades = Array.isArray(book.trades) ? book.trades : Array.isArray(root.trades) ? root.trades : [];
  return {
    simulatedTrades: root.simulatedTrades ?? book.verified ?? metrics.verifiedTrades ?? 0,
    winRatePct: root.winRatePct ?? metrics.winRatePct ?? null,
    netPnlPct: root.netPnlPct ?? metrics.netReturnPct ?? null,
    drawdownPct: root.drawdownPct ?? metrics.maxDrawdownPct ?? null,
    trades,
    note: root.note || (root.status ? `Estado Paper: ${root.status}. Sólo se publican operaciones con entrada, salida y evidencia verificadas.` : ''),
    funnel: root.funnel || null,
  };
}

function renderPaper(paper) {
  const p = normalizedPaperPayload(paper);
  $('pTrades').textContent = Number.isFinite(Number(p.simulatedTrades)) ? String(Number(p.simulatedTrades)) : '--';
  $('pWin').textContent = Number.isFinite(Number(p.winRatePct)) ? fmtPct(p.winRatePct) : '--';
  $('pPnl').textContent = Number.isFinite(Number(p.netPnlPct)) ? fmtPct(p.netPnlPct, 2) : '--';
  $('pDd').textContent = Number.isFinite(Number(p.drawdownPct)) ? fmtPct(p.drawdownPct, 2) : '--';
  if (p.note) $('paperNote').textContent = p.note;
  $('tradesBody').innerHTML = p.trades.length ? p.trades.map((x) => `
    <tr><td>${fmtTime(x.closedAt || x.timestamp)}</td><td>${x.horizon || '--'}</td><td>${fmtUsd(x.entryPrice)}</td>
    <td>${fmtUsd(x.exitPrice)}</td><td>${x.result || '--'}</td><td>${Number.isFinite(Number(x.netPnlPct)) ? fmtPct(x.netPnlPct, 2) : '--'}</td><td>${x.evidenceRef || '--'}</td></tr>`).join('')
    : '<tr><td colspan="7">Sin trades simulados verificados publicados por la API.</td></tr>';
  renderFunnel(p.funnel);
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

function renderModelData(data, { stale = false } = {}) {
  modelState = data;
  const rt = data.runtime || {};
  const ready = rt.ready === true && rt.shadowMode === true && rt.operationMode === 'SPOT_ONLY' && rt.allowShort === false;
  if (stale) {
    setClassText('engineState', 'ÚLTIMO DATO', 'warnText');
    $('engineMeta').textContent = 'snapshot verificado';
    setClassText('apiStatus', 'OFFLINE', 'badText');
    $('runtimeChip').className = 'chip warn';
    $('runtimeChip').textContent = '● ÚLTIMO DATO VERIFICADO';
  } else {
    setClassText('engineState', ready ? 'ONLINE' : 'NOT READY', ready ? 'goodText' : 'badText');
    $('engineMeta').textContent = ready ? 'runtime validado' : 'fail-closed';
    setClassText('apiStatus', 'ONLINE', 'goodText');
    $('runtimeChip').className = `chip ${ready ? 'good' : 'bad'}`;
    $('runtimeChip').textContent = ready ? '● MOTOR ONLINE' : '● MOTOR NOT READY';
  }
  $('runtimeText').textContent = stale
    ? `${rt.modelVersion || CONFIG.modelVersion} · ${rt.operationMode || '--'} · último snapshot local verificado`
    : `${rt.modelVersion || CONFIG.modelVersion} · ${rt.operationMode || '--'} · SHADOW=${rt.shadowMode === true ? 'true' : '--'}`;
  $('revision').textContent = rt.revision || '--';
  $('lastCycle').textContent = fmtTime(rt.lastSuccessfulCycleAt);
  $('errorState').textContent = rt.errorState || 'NONE';
  $('apiGenerated').textContent = fmtTime(data.generatedAt);
  $('systemRuntime').textContent = rt.revision || '--';
  $('systemApi').textContent = data.apiRevision || data.serviceRevision || data.apiVersion || '--';
  $('systemMode').textContent = `${data.mode || '--'} / ${data.spotOnly ? 'SPOT_ONLY' : '--'}`;
  setTrial(data.trial, { stale });
  renderDecisions(data.decisions);
  renderPaper(data.paper);
  updateFreshness();
  $('sideDetail').textContent = stale
    ? 'API temporalmente offline. Se conserva el último snapshot verificado; no se inventan datos nuevos.'
    : 'Motor, trial y funnel servidos por API sanitizada sólo lectura.';
}

function renderUnavailableState() {
  setClassText('engineState', 'SIN API', 'badText');
  $('engineMeta').textContent = 'fail-closed';
  setClassText('apiStatus', 'OFFLINE', 'badText');
  $('runtimeChip').className = 'chip bad';
  $('runtimeChip').textContent = '● API READ-ONLY OFFLINE';
  $('runtimeText').textContent = 'No hay snapshot verificado disponible. El dashboard no sustituye datos faltantes por cero.';
  $('sideDetail').textContent = 'La API read-only no respondió y todavía no existe un snapshot local verificado.';
  setTrial(BASE_TRIAL);
  renderFunnel(null);
  $('pTrades').textContent = '--';
  updateFreshness();
}

async function loadModel() {
  try {
    const data = await fetchJson(`${CONFIG.apiBase}/api/v1/dashboard`, 14000);
    renderModelData(data);
    saveVerifiedSnapshot(data);
  } catch (error) {
    if (modelState && snapshotIsSafe(modelState)) {
      renderModelData(modelState, { stale: true });
    } else {
      const cached = readVerifiedSnapshot();
      if (cached) renderModelData(cached, { stale: true });
      else renderUnavailableState();
    }
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
  ensureFunnelUi();
  const cached = readVerifiedSnapshot();
  if (cached) renderModelData(cached, { stale: true });
  else renderUnavailableState();
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
