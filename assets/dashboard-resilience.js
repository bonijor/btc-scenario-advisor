const SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_FUTURE_TOLERANCE_MS = 60 * 1000;

function funnelEl(id) {
  return document.getElementById(id);
}

export function snapshotIsSafe(data, trialId, requiredDays = 90) {
  if (!data || typeof data !== 'object') return false;
  const rt = data.runtime || {};
  const trial = data.trial || {};
  const days = Number(trial.completedDays);
  return data.mode === 'SHADOW'
    && data.spotOnly === true
    && data.automaticExecution === false
    && rt.shadowMode === true
    && rt.operationMode === 'SPOT_ONLY'
    && rt.allowShort === false
    && trial.trialId === trialId
    && trial.status === 'VERIFIED'
    && Number.isFinite(days)
    && days >= 0
    && days <= requiredDays;
}

function cacheProjection(data) {
  const paper = data.paper && typeof data.paper === 'object' ? data.paper : null;
  return {
    apiVersion: data.apiVersion,
    generatedAt: data.generatedAt,
    mode: data.mode,
    spotOnly: data.spotOnly,
    automaticExecution: data.automaticExecution,
    runtime: data.runtime,
    trial: data.trial,
    decisions: Array.isArray(data.decisions) ? data.decisions.slice(0, 15) : [],
    paper: paper ? {
      status: paper.status,
      funnel: paper.funnel,
      paper: paper.paper ? {
        activeOpen: paper.paper.activeOpen,
        verified: paper.paper.verified,
        metrics: paper.paper.metrics,
        trades: Array.isArray(paper.paper.trades) ? paper.paper.trades.slice(0, 20) : [],
      } : undefined,
      simulatedTrades: paper.simulatedTrades,
      winRatePct: paper.winRatePct,
      netPnlPct: paper.netPnlPct,
      drawdownPct: paper.drawdownPct,
      trades: Array.isArray(paper.trades) ? paper.trades.slice(0, 20) : undefined,
      note: paper.note,
    } : null,
  };
}

export function saveVerifiedSnapshot(storage, key, data, trialId, requiredDays = 90, now = Date.now()) {
  if (!snapshotIsSafe(data, trialId, requiredDays)) return false;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: now, data: cacheProjection(data) }));
    return true;
  } catch {
    return false;
  }
}

export function readVerifiedSnapshot(storage, key, trialId, requiredDays = 90, now = Date.now()) {
  try {
    const cached = JSON.parse(storage.getItem(key) || 'null');
    const savedAt = Number(cached?.savedAt);
    const fresh = Number.isFinite(savedAt)
      && savedAt <= now + SNAPSHOT_FUTURE_TOLERANCE_MS
      && now - savedAt <= SNAPSHOT_MAX_AGE_MS;
    if (cached && fresh && snapshotIsSafe(cached.data, trialId, requiredDays)) return cached.data;
    storage.removeItem(key);
  } catch {
    try { storage.removeItem(key); } catch {}
  }
  return null;
}

export function normalizedPaperPayload(payload) {
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

function ensureFunnelUi() {
  if (funnelEl('paperFunnelPanel')) return;
  const paperTable = document.querySelector('#paper .tableWrap');
  if (!paperTable) return;
  paperTable.insertAdjacentHTML('beforebegin', `
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

export function renderFunnel(funnel) {
  ensureFunnelUi();
  if (!funnelEl('paperFunnelPanel')) return;
  const f = funnel && typeof funnel === 'object' ? funnel : null;
  if (!f) {
    ['funnelObserved', 'funnelOfficial', 'funnelBullish', 'funnelConfidence', 'funnelEligible'].forEach((id) => {
      const el = funnelEl(id);
      if (el) el.textContent = '--';
    });
    const status = funnelEl('funnelStatus');
    const reasons = funnelEl('funnelReasons');
    if (status) status.textContent = 'sin datos';
    if (reasons) reasons.textContent = 'Esperando evidencia del funnel.';
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
