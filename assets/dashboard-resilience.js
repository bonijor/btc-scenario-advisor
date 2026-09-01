function funnelEl(id) {
  return document.getElementById(id);
}

export function snapshotIsSafe(data, trialId, requiredDays = 90) {
  if (!data || typeof data !== 'object') return false;
  const rt = data.runtime || {};
  const trial = data.trial || {};
  return data.mode === 'SHADOW'
    && data.spotOnly === true
    && data.automaticExecution === false
    && rt.shadowMode === true
    && rt.operationMode === 'SPOT_ONLY'
    && rt.allowShort === false
    && trial.trialId === trialId
    && Number.isFinite(Number(trial.completedDays))
    && Number(trial.completedDays) >= 0
    && Number(trial.completedDays) <= requiredDays;
}

export function saveVerifiedSnapshot(storage, key, data, trialId, requiredDays = 90) {
  if (!snapshotIsSafe(data, trialId, requiredDays)) return;
  try {
    storage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cache is best effort only.
  }
}

export function readVerifiedSnapshot(storage, key, trialId, requiredDays = 90) {
  try {
    const cached = JSON.parse(storage.getItem(key) || 'null');
    return cached && snapshotIsSafe(cached.data, trialId, requiredDays) ? cached.data : null;
  } catch {
    return null;
  }
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
