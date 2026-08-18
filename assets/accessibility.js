(() => {
  const params = new URLSearchParams(location.search);
  const qaMode = params.get('qa');

  if (qaMode === 'performance' || qaMode === 'a11y') {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const raw = typeof input === 'string' ? input : input?.url;
      const url = new URL(raw || '', location.href);
      if (url.origin === location.origin) return nativeFetch(input, init);
      return Promise.reject(new DOMException('External network disabled during deterministic QA', 'AbortError'));
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

  const enhance = () => {
    syncNavigationState();
    syncTimeframeState();
    syncRefreshState();
    syncChartSummary();

    const app = document.querySelector('.app');
    if (app) {
      const stateObserver = new MutationObserver(() => {
        syncNavigationState();
        syncTimeframeState();
        syncRefreshState();
      });
      stateObserver.observe(app, { subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
    }

    const chartObserver = new MutationObserver(syncChartSummary);
    ['chartTf', 'candleOpen', 'candleHigh', 'candleLow', 'candleClose'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) chartObserver.observe(node, { childList: true, characterData: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(enhance, 0), { once: true });
  else setTimeout(enhance, 0);
})();
