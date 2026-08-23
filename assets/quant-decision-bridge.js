(() => {
  'use strict';

  const PROTOCOL = 'btc-shadow-paper-distance-to-eligible/1.0';
  if (window.__BTC_QUANT_DIAGNOSTIC_FETCH_BRIDGE__ === true) return;
  window.__BTC_QUANT_DIAGNOSTIC_FETCH_BRIDGE__ = true;

  const check = (diagnostic, id) => Array.isArray(diagnostic?.checks)
    ? diagnostic.checks.find((item) => item?.id === id) || null
    : null;

  function decisionsFromPaper(paper) {
    const diagnostics = Array.isArray(paper?.funnel?.diagnostics)
      ? paper.funnel.diagnostics.filter((item) =>
        item?.protocol === PROTOCOL && (item?.horizon === '5m' || item?.horizon === '15m'))
      : [];
    const timestamp = paper?.latestRun?.lastSuccessfulCycleAt || paper?.generatedAt || null;
    return diagnostics.map((diagnostic) => {
      const action = check(diagnostic, 'shadowAction')?.actual;
      return {
        timestamp,
        signalId: diagnostic.signalId || null,
        horizon: diagnostic.horizon || null,
        decision: action && typeof action === 'object' ? action.suggested || null : null,
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

  const baseFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await baseFetch(input, init);
    let url;
    try { url = new URL(input?.url || input, location.href); } catch { return response; }
    if (url.pathname !== '/api/v1/dashboard' || !response.ok) return response;
    try {
      const data = await response.clone().json();
      if (Array.isArray(data?.decisions) && data.decisions.length) return response;
      const decisions = decisionsFromPaper(data?.paper || {});
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

  window.BTCQuantDecisionBridge = Object.freeze({ protocol: PROTOCOL, decisionsFromPaper });
  if (document.body.classList.contains('auth-granted')) setTimeout(() => window.refreshAll?.(), 0);
})();
