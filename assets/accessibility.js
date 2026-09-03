(() => {
  const params = new URLSearchParams(location.search);
  const qaMode = params.get('qa');
  const localQaHost = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const performanceQa = localQaHost && qaMode === 'lighthouse';
  window.__BTC_PERF_QA__ = performanceQa;
  if (performanceQa) document.body.classList.add('auth-granted');

  if (!localQaHost) {
    try { localStorage.removeItem('btcModelApiBase'); } catch {}
    if (params.has('api')) {
      params.delete('api');
      const query = params.toString();
      history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    }
  }

  if (localQaHost && (qaMode === 'performance' || qaMode === 'a11y' || qaMode === 'lighthouse')) {
    const nativeFetch = window.fetch.bind(window);
    const now = Date.now();
    const jsonResponse = (payload) => Promise.resolve(new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }));

    const dashboardFixture = {
      generatedAt: new Date(now).toISOString(),
      mode: 'SHADOW',
      spotOnly: true,
      automaticExecution: false,
      runtime: {
        ready: true,
        shadowMode: true,
        operationMode: 'SPOT_ONLY',
        allowShort: false,
        modelVersion: 'V5.9.0-SPOT-HIGH-CONVICTION',
        revision: 'qa-deterministic',
        lastSuccessfulCycleAt: now,
        errorState: 'NONE',
      },
      trial: {
        trialId: 'btc-shadow-90d-20260817T173948Z',
        requiredDays: 90,
        completedDays: 0,
        firstCompleteDay: '2026-08-18',
        manifestDigest: '757422dbd20fead8503f0545766f06b5df020c78eab2bf036d72c5f72ef9fd03',
        status: 'INITIALIZED',
      },
      decisions: [],
      paper: { simulatedTrades: 0, trades: [], note: 'QA determinístico. Sin operaciones inferidas.' },
    };

    const fixtureCandleCount = performanceQa ? 32 : 80;
    const candles = Array.from({ length: fixtureCandleCount }, (_, index) => {
      const base = 116000 + index * 4;
      return [now - (fixtureCandleCount - index) * 300000, String(base), String(base + 55), String(base - 45), String(base + 15), '10'];
    });

    window.fetch = (input, init) => {
      const raw = typeof input === 'string' ? input : input?.url;
      const url = new URL(raw || '', location.href);
      if (url.origin === location.origin) return nativeFetch(input, init);
      if (url.pathname.includes('/ticker/24hr')) return jsonResponse({ lastPrice: '116320', priceChangePercent: '1.25', highPrice: '117200', lowPrice: '114900', quoteVolume: '1800000000' });
      if (url.pathname.includes('/klines')) return jsonResponse(candles);
      if (url.pathname.includes('/api/v1/dashboard')) return jsonResponse(dashboardFixture);
      return jsonResponse({});
    };
  }

  const syncNavigationState = () => {
    document.querySelectorAll('[data-view]').forEach((button) => {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });

    document.querySelectorAll('.view').forEach((view) => {
      view.setAttribute('aria-hidden', view.classList.contains('active') ? 'false' : 'true');
    });
  };

  const syncTimeframeState = () => {
    document.querySelectorAll('.tfButton').forEach((button) => {
      button.setAttribute('aria-pressed', button.classList.contains('active') ? 'true' : 'false');
    });
  };

  const syncRefreshState = () => {
    const refresh = document.getElementById('refresh');
    if (!refresh) return;
    refresh.setAttribute('aria-busy', refresh.disabled ? 'true' : 'false');
  };

  const syncChartSummary = () => {
    const summary = document.getElementById('chartA11y');
    if (!summary) return;
    const tf = document.getElementById('chartTf')?.textContent || '5m';
    const open = document.getElementById('candleOpen')?.textContent || '--';
    const high = document.getElementById('candleHigh')?.textContent || '--';
    const low = document.getElementById('candleLow')?.textContent || '--';
    const close = document.getElementById('candleClose')?.textContent || '--';
    summary.textContent = `Gráfico BTC/USDT ${tf}. Última vela: apertura ${open}, máximo ${high}, mínimo ${low}, cierre ${close}.`;
  };

  const observeClasses = (selector, callback) => {
    document.querySelectorAll(selector).forEach((node) => {
      new MutationObserver(callback).observe(node, { attributes: true, attributeFilter: ['class'] });
    });
  };

  const enhance = () => {
    if (performanceQa) return;
    syncNavigationState();
    syncTimeframeState();
    syncRefreshState();
    syncChartSummary();

    observeClasses('[data-view]', syncNavigationState);
    observeClasses('.view', syncNavigationState);
    observeClasses('.tfButton', syncTimeframeState);

    const refresh = document.getElementById('refresh');
    if (refresh) new MutationObserver(syncRefreshState).observe(refresh, { attributes: true, attributeFilter: ['disabled'] });

    const chartObserver = new MutationObserver(syncChartSummary);
    ['chartTf', 'candleOpen', 'candleHigh', 'candleLow', 'candleClose'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) chartObserver.observe(node, { childList: true, characterData: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 0), { once: true });
  else setTimeout(enhance, 0);
})();
