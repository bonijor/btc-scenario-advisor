(() => {
  'use strict';

  const DIAGNOSTIC_PROTOCOL = 'btc-shadow-paper-distance-to-eligible/1.0';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const num = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const pct = (value, digits = 1) => {
    const parsed = num(value);
    return parsed === null ? '--' : `${parsed.toFixed(digits)}%`;
  };

  const money = (value, digits = 2) => {
    const parsed = num(value);
    return parsed === null ? '--' : new Intl.NumberFormat('es-AR', {
      style: 'currency', currency: 'USD', maximumFractionDigits: digits,
    }).format(parsed);
  };

  function diagnosticValue(value, unit) {
    if (value === null || value === undefined || value === '') return '--';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (unit === 'ratio') return pct(value * 100, 2);
      if (unit === 'quote') return money(value);
      if (unit === 'seconds') return `${value.toFixed(value % 1 ? 1 : 0)} s`;
      return value.toLocaleString('es-AR', { maximumFractionDigits: 4 });
    }
    if (Array.isArray(value)) return value.map(String).join(' / ');
    if (typeof value === 'object') {
      return Object.values(value).filter((item) => item !== null && item !== undefined).map(String).join(' · ') || '--';
    }
    return String(value);
  }

  function requirement(check) {
    const comparator = check?.comparator === 'in' ? '∈' : check?.comparator === 'exact' ? '=' : check?.comparator || '=';
    return `${comparator} ${diagnosticValue(check?.target, check?.unit)}`;
  }

  function officialDiagnostics(paper) {
    return Array.isArray(paper?.funnel?.diagnostics)
      ? paper.funnel.diagnostics.filter((item) =>
        item?.protocol === DIAGNOSTIC_PROTOCOL && (item?.horizon === '5m' || item?.horizon === '15m'))
      : [];
  }

  function check(diagnostic, id) {
    return Array.isArray(diagnostic?.checks)
      ? diagnostic.checks.find((item) => item?.id === id) || null
      : null;
  }

  function quantDecisionsFromDiagnostics(paper) {
    const timestamp = paper?.latestRun?.lastSuccessfulCycleAt || paper?.generatedAt || null;
    return officialDiagnostics(paper).map((diagnostic) => {
      const action = check(diagnostic, 'shadowAction')?.actual;
      const actionSuggested = action && typeof action === 'object' ? action.suggested : null;
      return {
        timestamp,
        signalId: diagnostic.signalId || null,
        horizon: diagnostic.horizon || null,
        decision: actionSuggested || null,
        reason: diagnostic.firstFailureReason || diagnostic.result || null,
        activation: check(diagnostic, 'activationReached')?.target ?? null,
        invalidation: null,
        signalQuality: check(diagnostic, 'dataQuality')?.actual ?? null,
        balancedAccuracy: check(diagnostic, 'balancedAccuracy')?.actual ?? null,
        brierSkillScore: check(diagnostic, 'brierSkill')?.actual ?? null,
        ece: check(diagnostic, 'ece')?.actual ?? null,
        evaluatedSamples: check(diagnostic, 'evaluatedCount')?.actual ?? null,
        executionViability: diagnostic.eligible === true ? 'ELIGIBLE' : 'BLOQUEADA',
        modelState: 'SHADOW',
        source: 'paper-distance-to-eligible-v2.1',
      };
    });
  }

  function installDashboardDecisionBridge() {
    if (window.__BTC_QUANT_DIAGNOSTIC_FETCH_BRIDGE__ === true) return;
    window.__BTC_QUANT_DIAGNOSTIC_FETCH_BRIDGE__ = true;
    const baseFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const response = await baseFetch(input, init);
      let url;
      try { url = new URL(input?.url || input, location.href); } catch { return response; }
      if (url.pathname !== '/api/v1/dashboard' || !response.ok) return response;
      try {
        const data = await response.clone().json();
        if (Array.isArray(data?.decisions) && data.decisions.length) return response;
        const decisions = quantDecisionsFromDiagnostics(data?.paper || {});
        if (!decisions.length) return response;
        const headers = new Headers(response.headers);
        headers.delete('content-length');
        headers.set('content-type', 'application/json; charset=utf-8');
        return new Response(JSON.stringify({ ...data, decisions }), {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        return response;
      }
    };
  }

  function ensureDiagnosticsCard() {
    let card = $('apDiagnosticsCard');
    if (card) return card;
    const anchor = document.querySelector('.ap-grid');
    if (!anchor) return null;
    card = document.createElement('article');
    card.id = 'apDiagnosticsCard';
    card.className = 'panel content ap-diagnostics-card';
    card.innerHTML = `
      <div class="head">
        <div><div class="ey">Funnel diagnostics</div><h3>Distance to Eligible</h3></div>
        <span class="chip" id="apDiagnosticsState">NO_DATA</span>
      </div>
      <p class="tiny ap-diagnostics-copy">KPIs 5m/15m leídos del mismo contrato que gobierna elegibilidad. Read-only: no modifica thresholds ni ejecución.</p>
      <div class="ap-diagnostics-grid" id="apDiagnostics"></div>`;
    anchor.insertAdjacentElement('afterend', card);
    return card;
  }

  function renderDiagnostics(paper) {
    ensureDiagnosticsCard();
    const node = $('apDiagnostics');
    const state = $('apDiagnosticsState');
    if (!node) return;

    const diagnostics = officialDiagnostics(paper);
    diagnostics.sort((a, b) => (a.horizon === '5m' ? -1 : 1) - (b.horizon === '5m' ? -1 : 1));

    if (!diagnostics.length) {
      if (state) state.textContent = 'NO_DATA';
      node.innerHTML = `<div class="ap-diagnostics-empty">
        <strong>Diagnóstico v2.1 pendiente</strong>
        <span>La respuesta actual no incluye <code>funnel.diagnostics</code>. El embudo base sigue siendo válido, pero los KPIs Distance to Eligible no se inventan ni se convierten en cero.</span>
      </div>`;
      return;
    }

    if (state) state.textContent = `${diagnostics.length}/2 LIVE`;
    node.innerHTML = diagnostics.map((diagnostic) => {
      const progress = Math.max(0, Math.min(100, num(diagnostic.progressPct) ?? 0));
      const remaining = num(diagnostic.remainingChecks);
      const checks = Array.isArray(diagnostic.checks) ? diagnostic.checks : [];
      const failed = checks.filter((item) => item?.pass !== true).length;
      const firstFailure = diagnostic.firstFailureReason || 'NINGUNO';

      const checkRows = checks.map((item) => {
        const pass = item?.pass === true;
        const shortfall = num(item?.shortfall);
        return `<div class="ap-check ${pass ? 'pass' : 'fail'}">
          <div class="ap-check-main"><span>${pass ? '✓' : '×'}</span><b>${esc(item?.label || item?.id || 'Check')}</b><strong>${esc(diagnosticValue(item?.actual, item?.unit))}</strong></div>
          <div class="ap-check-meta"><code>${esc(item?.id || '--')}</code><span>objetivo ${esc(requirement(item))}</span>${shortfall !== null && shortfall > 0 ? `<em>falta ${esc(diagnosticValue(shortfall, item?.unit))}</em>` : ''}</div>
        </div>`;
      }).join('');

      return `<section class="ap-diagnostic-signal">
        <div class="ap-diagnostic-top">
          <div><span>${esc(diagnostic.horizon || '--')}</span><h4>${diagnostic.eligible === true ? 'ELIGIBLE' : 'NO ELIGIBLE'}</h4></div>
          <strong>${progress.toFixed(0)}%</strong>
        </div>
        <div class="ap-diagnostic-progress"><i style="width:${progress}%"></i></div>
        <div class="ap-diagnostic-meta"><span>${esc(String(diagnostic.passedChecks ?? '--'))}/${esc(String(diagnostic.totalChecks ?? '--'))} checks</span><span>restan ${remaining ?? '--'}</span><span>fallan ${failed}</span></div>
        <div class="ap-first-failure"><span>Primer bloqueo</span><b>${esc(firstFailure)}</b></div>
        <details>
          <summary>Ver todos los KPIs (${checks.length})</summary>
          <div class="ap-check-list">${checkRows || '<div class="ap-diagnostics-empty"><span>Sin checks publicados.</span></div>'}</div>
        </details>
      </section>`;
    }).join('');
  }

  function applyNoDataSemantics(paper) {
    const state = paper?.paper || {};
    const metrics = state.metrics || {};
    const verifiedTrades = num(metrics.verifiedTrades) ?? num(state.verified) ?? 0;
    const hasVerifiedTrades = verifiedTrades > 0;

    const set = (id, value) => { const node = $(id); if (node) node.textContent = value; };

    if (!hasVerifiedTrades) {
      set('apPnl', '--');
      set('apReturn', 'retorno NO_DATA');
      set('apWin', '--');
      set('apRecord', 'NO_DATA · 0W · 0L');
      set('pWin', '--');
      set('pPnl', '--');
      set('pDd', '--');
      return;
    }

    set('apPnl', money(metrics.netPnlQuote));
    set('apReturn', `retorno ${pct(metrics.netReturnPct, 2)}`);
    set('apWin', pct(metrics.winRatePct));
    set('pWin', pct(metrics.winRatePct));
    set('pPnl', money(metrics.netPnlQuote));
    set('pDd', pct(metrics.maxTradeLossPct, 2));
  }

  function applyContract(paper) {
    applyNoDataSemantics(paper);
    renderDiagnostics(paper);
  }

  function install() {
    if (window.renderPaper?.__btcKpiContract === true) return true;
    if (typeof window.renderPaper !== 'function' || !window.BTCAutoPaper) return false;

    const baseRender = window.renderPaper;
    const wrapped = function wrappedAutoPaper(paper) {
      const result = baseRender(paper);
      applyContract(paper || {});
      return result;
    };
    wrapped.__btcKpiContract = true;
    window.renderPaper = wrapped;
    window.BTCAutoPaperKpi = Object.freeze({
      protocol: DIAGNOSTIC_PROTOCOL,
      version: '1.1',
      render: applyContract,
      quantDecisionsFromDiagnostics,
    });

    setTimeout(() => $('refresh')?.click(), 0);
    return true;
  }

  installDashboardDecisionBridge();

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts >= 50) clearInterval(timer);
    }, 100);
  }
})();
