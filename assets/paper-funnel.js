(() => {
  'use strict';

  const STAGES = [
    ['observed', 'Mercado observado'],
    ['officialHorizon', 'Horizontes 5m / 15m'],
    ['bullishBias', 'Sesgo alcista'],
    ['highConfidence', 'Alta confianza'],
    ['dataIntegrity', 'Datos íntegros'],
    ['quantThresholds', 'Umbrales Quant'],
    ['calibration', 'Calibración'],
    ['activation', 'Activación'],
    ['shadowOnly', 'SHADOW only'],
    ['eligible', 'Eligible'],
  ];

  const STATUS = {
    WAITING_CONDITIONS: ['Esperando condiciones', 'waiting', 'El motor observa mercado real, pero ninguna señal 5m/15m atravesó todavía el funnel completo.'],
    WAITING_ENTRY: ['Señal elegible · esperando entrada', 'armed', 'La señal superó los filtros y espera una vela cerrada válida para fijar la entrada Paper.'],
    PAPER_OPEN: ['Paper OPEN', 'open', 'Existe una posición simulada persistida y se espera el cierre del horizonte.'],
    VERIFIED: ['Lifecycle VERIFIED', 'verified', 'Existe evidencia completa OPEN → CLOSE con costos, P&L y digest verificado.'],
  };

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const num = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const money = (value, digits = 2) => {
    const n = num(value);
    return n === null ? '--' : new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'USD', maximumFractionDigits: digits,
    }).format(n);
  };

  const pct = (value, digits = 1) => {
    const n = num(value);
    return n === null ? '--' : `${n.toFixed(digits)}%`;
  };

  const probability = (value) => {
    const n = num(value);
    if (n === null) return '--';
    return pct(n <= 1 ? n * 100 : n, 1);
  };

  const localTime = (value) => {
    if (value === null || value === undefined || value === '') return '--';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '--' : date.toLocaleString('es-AR', { hour12: false });
  };

  const shortDigest = (value) => {
    const text = String(value || '');
    return text.length >= 18 ? `${text.slice(0, 10)}…${text.slice(-8)}` : (text || '--');
  };

  function shell() {
    const section = $('paper');
    if (!section || section.dataset.autopaperReady === 'true') return;
    section.dataset.autopaperReady = 'true';
    section.setAttribute('aria-label', 'Auto-Paper');
    section.innerHTML = `
      <div class="ap-shell">
        <article class="panel content ap-hero">
          <div class="ap-hero-copy">
            <div class="ey">Auto-Paper · inputs reales · rehearsal</div>
            <h2>Funnel de validación</h2>
            <p class="tiny">Mercado → elegibilidad → OPEN → VERIFIED. La evidencia Paper es read-only y permanece separada del contador formal de 90 días.</p>
          </div>
          <div class="ap-status" id="apStatus">Validando…</div>
        </article>

        <div class="ap-safety" aria-label="Guardrails de Auto-Paper">
          <span>SHADOW</span><span>SPOT_ONLY</span><span>NO SELL</span><span>NO SHORTS</span><span>NO REAL ORDERS</span>
        </div>

        <div class="ap-summary">
          <article class="panel ap-metric"><span>Observadas</span><strong id="apObserved">0</strong><small>último ciclo</small></article>
          <article class="panel ap-metric"><span>Eligible</span><strong id="apEligible">0</strong><small>funnel completo</small></article>
          <article class="panel ap-metric"><span>Paper OPEN</span><strong id="apOpen">0</strong><small>posiciones activas</small></article>
          <article class="panel ap-metric"><span>VERIFIED</span><strong id="apVerified">0</strong><small>trades con evidencia</small></article>
          <article class="panel ap-metric"><span>P&L Paper</span><strong id="apPnl">--</strong><small id="apReturn">retorno --</small></article>
          <article class="panel ap-metric"><span>Win rate</span><strong id="apWin">--</strong><small id="apRecord">0W · 0L</small></article>
        </div>

        <div class="ap-grid">
          <article class="panel content ap-funnel-card">
            <div class="head">
              <div><div class="ey">Último ciclo real</div><h3>Embudo de señales</h3></div>
              <small class="tiny" id="apRunTime">--</small>
            </div>
            <div class="ap-funnel" id="apFunnel"></div>
            <div class="ap-evidence"><span id="apRejects">Bloqueos: --</span><span id="apSummarySha">Summary SHA --</span></div>
          </article>

          <aside class="ap-side">
            <article class="panel content ap-state-card">
              <div class="ey">Estado 3C</div>
              <h3 id="apStateTitle">Validando evidencia</h3>
              <p class="tiny" id="apStateDetail">Esperando contrato read-only v2.</p>
              <div class="ap-kv"><span>Outcome</span><b id="apOutcome">--</b></div>
              <div class="ap-kv"><span>Run</span><b id="apRunId">--</b></div>
              <div class="ap-kv"><span>Runtime</span><b id="apRuntime">--</b></div>
            </article>
            <article class="panel content ap-trial-note">
              <div class="ey">Separación 90D</div>
              <h3>Rehearsal ≠ día formal</h3>
              <p class="tiny">Los runs Auto-Paper muestran comportamiento real del funnel, pero no incrementan el contador de 90 días. Ese contador sólo avanza con evidencia del ledger formal.</p>
            </article>
          </aside>
        </div>

        <article class="panel content ap-table-card">
          <div class="head"><div><div class="ey">Lifecycle activo</div><h3>Paper OPEN</h3></div><span class="chip" id="apOpenCount">0 abiertas</span></div>
          <div class="tableWrap" tabindex="0" role="region" aria-label="Posiciones Paper abiertas">
            <table><caption class="srOnly">Posiciones Paper abiertas</caption><thead><tr><th>TF</th><th>Entrada</th><th>Precio</th><th>Prob. subida</th><th>Target salida</th><th>Record SHA</th></tr></thead><tbody id="apOpenBody"><tr><td colspan="6">Sin posiciones Paper abiertas.</td></tr></tbody></table>
          </div>
        </article>

        <article class="panel content ap-table-card">
          <div class="head"><div><div class="ey">Evidencia cerrada</div><h3>Operaciones VERIFIED</h3></div><span class="chip good" id="apVerifiedCount">0 verificadas</span></div>
          <div class="tableWrap" tabindex="0" role="region" aria-label="Operaciones simuladas verificadas">
            <table><caption class="srOnly">Operaciones simuladas verificadas</caption><thead><tr><th>Fecha</th><th>TF</th><th>Entrada</th><th>Salida</th><th>P&L</th><th>Retorno</th><th>Fees</th><th>Evidence SHA</th></tr></thead><tbody id="tradesBody"><tr><td colspan="8">Sin trades simulados verificados.</td></tr></tbody></table>
          </div>
        </article>
      </div>`;

    const nav = document.querySelector('[data-view="paper"]');
    if (nav) nav.textContent = '◎ Auto-Paper';
  }

  function safetyOk(paper) {
    const safety = paper?.safety || {};
    return paper?.rehearsalOnly === true
      && paper?.formalTrialMutation === false
      && safety.realOrderCreated === false
      && safety.exchangeOrderRequestMade === false
      && safety.spotOnly === true
      && safety.shortsAllowed === false;
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = String(value ?? '--');
  }

  function renderFunnel(funnel) {
    const counts = funnel?.counts || {};
    const lifecycle = funnel?.lifecycle || {};
    const max = Math.max(1, ...STAGES.map(([key]) => Number(counts[key]) || 0));
    const stages = [
      ...STAGES.map(([key, label], index) => ({ key, label, count: Number(counts[key]) || 0, index: index + 1 })),
      { key: 'opened', label: 'Paper OPEN', count: Number(lifecycle.opened) || 0, index: 11 },
      { key: 'verified', label: 'VERIFIED', count: Number(lifecycle.verified) || 0, index: 12 },
    ];
    const node = $('apFunnel');
    if (!node) return;
    node.innerHTML = stages.map((stage) => {
      const width = stage.count > 0 ? Math.max(7, Math.min(100, (stage.count / max) * 100)) : 2;
      return `<div class="ap-stage ${stage.index > 10 ? 'lifecycle' : ''}">
        <div class="ap-stage-row"><span class="ap-index">${stage.index}</span><b>${esc(stage.label)}</b><strong>${stage.count}</strong></div>
        <div class="ap-track"><i style="width:${width}%"></i></div>
      </div>`;
    }).join('');
  }

  function renderOpen(openPositions) {
    const rows = Array.isArray(openPositions) ? openPositions : [];
    setText('apOpenCount', `${rows.length} abiertas`);
    const body = $('apOpenBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map((x) => `<tr>
      <td>${esc(x.horizon || '--')}</td><td>${esc(localTime(x.entryTime))}</td><td>${esc(money(x.entryPrice))}</td>
      <td>${esc(probability(x.probabilityUp))}</td><td>${esc(localTime(x.targetExitTime))}</td><td><code>${esc(shortDigest(x.recordDigest))}</code></td>
    </tr>`).join('') : '<tr><td colspan="6">Sin posiciones Paper abiertas.</td></tr>';
  }

  function renderTrades(trades) {
    const rows = Array.isArray(trades) ? trades : [];
    setText('apVerifiedCount', `${rows.length} verificadas`);
    const body = $('tradesBody');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map((x) => {
      const pnl = num(x.netPnlQuote);
      const ret = num(x.netReturn);
      const tone = pnl === null ? '' : (pnl >= 0 ? 'ap-positive' : 'ap-negative');
      return `<tr>
        <td>${esc(localTime(x.exitTime || x.closedAt || x.timestamp))}</td><td>${esc(x.horizon || '--')}</td>
        <td>${esc(money(x.entryPrice))}</td><td>${esc(money(x.exitPrice))}</td><td class="${tone}">${esc(money(pnl))}</td>
        <td>${esc(ret === null ? '--' : pct(ret * 100, 3))}</td><td>${esc(money(x.totalFeesQuote))}</td><td><code>${esc(shortDigest(x.evidenceDigest || x.evidenceRef))}</code></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8">Sin trades simulados verificados publicados por la API.</td></tr>';
  }

  function renderAutoPaper(paper) {
    shell();
    const p = paper || {};
    const state = p.paper || {};
    const metrics = state.metrics || {};
    const funnel = p.funnel || {};
    const counts = funnel.counts || {};
    const latest = p.latestRun || {};
    const statusKey = String(p.status || 'WAITING_CONDITIONS');
    const status = STATUS[statusKey] || [statusKey || 'Sin estado', 'waiting', 'Estado no reconocido por el frontend.'];

    if (!safetyOk(p)) {
      const badge = $('apStatus');
      if (badge) { badge.textContent = 'EVIDENCIA BLOQUEADA'; badge.className = 'ap-status blocked'; }
      setText('apStateTitle', 'Fail-closed');
      setText('apStateDetail', 'La evidencia Paper no cumple el safety envelope esperado. No se publican métricas como válidas.');
      return;
    }

    const badge = $('apStatus');
    if (badge) { badge.textContent = status[0]; badge.className = `ap-status ${status[1]}`; }
    setText('apStateTitle', status[0]);
    setText('apStateDetail', status[2]);
    setText('apObserved', Number(counts.observed) || 0);
    setText('apEligible', Number(counts.eligible) || 0);
    setText('apOpen', Number(state.activeOpen) || 0);
    setText('apVerified', Number(state.verified) || 0);
    setText('apPnl', money(metrics.netPnlQuote));
    setText('apReturn', `retorno ${pct(metrics.netReturnPct, 2)}`);
    setText('apWin', pct(metrics.winRatePct));
    setText('apRecord', `${Number(metrics.wins) || 0}W · ${Number(metrics.losses) || 0}L`);
    setText('apOutcome', latest.outcome || '--');
    setText('apRunId', latest.runId ? String(latest.runId).replace('T', ' ').replace('Z', 'Z') : '--');
    setText('apRuntime', latest.runtimeRevision || '--');
    setText('apRunTime', localTime(latest.runId));
    setText('apSummarySha', `Summary SHA ${shortDigest(latest.summaryDigest)}`);

    const rejects = Object.entries(funnel.rejectedByReason || {});
    setText('apRejects', rejects.length ? `Bloqueos: ${rejects.map(([reason, count]) => `${reason} ${count}`).join(' · ')}` : 'Bloqueos: ninguno');

    renderFunnel(funnel);
    renderOpen(state.openPositions);
    renderTrades(state.trades);

    setText('pTrades', Number(state.verified) || 0);
    setText('pWin', pct(metrics.winRatePct));
    setText('pPnl', pct(metrics.netReturnPct, 2));
    setText('pDd', pct(metrics.maxTradeLossPct, 2));
    const ddLabel = $('pDd')?.parentElement?.querySelector('span');
    if (ddLabel) ddLabel.textContent = 'Max pérdida/trade';
    setText('paperNote', status[2]);
  }

  function activate() {
    shell();
    window.renderPaper = renderAutoPaper;
    window.BTCAutoPaper = Object.freeze({ render: renderAutoPaper, version: '3D.1' });
    const refresh = $('refresh');
    if (refresh) setTimeout(() => refresh.click(), 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate, { once: true });
  } else {
    activate();
  }
})();
