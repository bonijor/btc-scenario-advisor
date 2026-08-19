(() => {
  'use strict';

  const navCopy = Object.freeze({
    overview: { icon: '▦', title: 'Resumen', desc: 'Estado del mercado y del motor' },
    markets: { icon: '◈', title: 'Mercados', desc: 'BTC, ETH y BNB en Binance Spot' },
    analytics: { icon: '⌁', title: 'Análisis', desc: 'Probabilidades y calidad predictiva' },
    paper: { icon: '◎', title: 'Simulaciones', desc: 'Señales, filtros y operaciones Paper' },
    trial: { icon: '◷', title: 'Prueba 90D', desc: 'Continuidad y evidencia verificable' },
    system: { icon: '⚙', title: 'Sistema', desc: 'Salud técnica, API y runtime' },
    account: { icon: '◉', title: 'Cuenta', desc: 'Plan, alertas y preferencias' },
  });

  const intros = Object.freeze({
    overview: '<b>Qué vas a encontrar:</b> precio BTC, salud del motor, decisiones 5m/15m, progreso 90D y resultados Paper. La capa Quant formal sigue siendo BTC/USDT.',
    analytics: '<b>Cómo leer esta pantalla:</b> BA mide separación de clases; ECE mide calibración; BSS compara contra un baseline. Importa la tendencia conjunta, no una métrica aislada.',
    paper: '<b>Qué cuenta como operación:</b> sólo un Paper trade con entrada, salida, costes y evidencia verificable. Una señal bloqueada es una decisión correcta de abstención, no un trade perdido.',
    trial: '<b>Qué valida la Prueba 90D:</b> continuidad, inmutabilidad y evidencia diaria del sistema. Un día verificado confirma integridad operativa; no significa que ese día haya sido rentable.',
    system: '<b>Para qué sirve Sistema:</b> muestra conectividad, runtime, contratos y estado técnico. Ante datos incompletos el producto debe fallar cerrado antes de inventar información.',
    account: '<b>Tu espacio personal:</b> identidad, plan PRO, alertas y preferencias. El plan Premium no puede modificar el modelo, sus umbrales ni habilitar trading real.',
  });

  const marketAssets = Object.freeze([
    { symbol: 'BTCUSDT', code: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', code: 'ETH', name: 'Ethereum' },
    { symbol: 'BNBUSDT', code: 'BNB', name: 'BNB' },
  ]);

  let marketRefreshTimer = null;
  let guidedLoadScheduled = false;
  const $ = (selector, root = document) => root.querySelector(selector);

  function setTheme(theme, persist = true) {
    const value = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = value;
    if (persist) localStorage.setItem('scenarioTheme', value);
    const button = $('#themeToggle');
    if (button) {
      button.textContent = value === 'dark' ? '☀ Claro' : '◐ Oscuro';
      button.setAttribute('aria-label', value === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro');
      button.title = value === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
    }
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === 'dark' ? '#050a12' : '#f2f6fb');
  }

  function applyBrand() {
    const mark = $('.brandMark');
    if (mark) mark.innerHTML = '<img src="assets/scenario-mark.svg" alt="">';
    const strong = $('.brand strong');
    const small = $('.brand small');
    if (strong) strong.textContent = 'Scenario Advisor';
    if (small) small.textContent = 'PRO · Crypto Shadow Lab';
    document.title = 'Scenario Advisor PRO · Crypto Shadow Lab';
    let favicon = $('link[data-scenario-favicon]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      favicon.type = 'image/svg+xml';
      favicon.dataset.scenarioFavicon = '1';
      document.head.append(favicon);
    }
    favicon.href = 'assets/scenario-mark.svg';
  }

  function formatNavigationButton(button) {
    const copy = navCopy[button.dataset.view];
    if (!copy) return;
    button.innerHTML = `<span class="navLabel"><span aria-hidden="true">${copy.icon}</span>${copy.title}</span><small class="navDesc">${copy.desc}</small>`;
    button.setAttribute('aria-label', `${copy.title}. ${copy.desc}`);
    button.title = `${copy.title} · ${copy.desc}`;
  }

  function insertNavGroup(nav, title, beforeView) {
    const target = nav.querySelector(`[data-view="${beforeView}"]`);
    if (!target) return;
    const label = document.createElement('span');
    label.className = 'navGroup';
    label.textContent = title;
    nav.insertBefore(label, target);
  }

  function enhanceNavigation() {
    const nav = $('.nav');
    if (!nav || nav.dataset.productUx === '1') return;
    nav.dataset.productUx = '1';
    nav.querySelectorAll('.navGroup').forEach((node) => node.remove());
    nav.querySelectorAll('[data-view]').forEach(formatNavigationButton);
    insertNavGroup(nav, 'Mercado', 'overview');
    insertNavGroup(nav, 'Validación', 'paper');
    insertNavGroup(nav, 'Plataforma', 'system');
  }

  function openView(name) {
    document.querySelectorAll('.view').forEach((view) => {
      const active = view.id === name;
      view.classList.toggle('active', active);
      view.setAttribute('aria-hidden', String(!active));
    });
    document.querySelectorAll('[data-view]').forEach((button) => {
      const active = button.dataset.view === name;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function addThemeToggle() {
    const actions = $('.topActions');
    if (!actions || $('#themeToggle')) return;
    const button = document.createElement('button');
    button.className = 'btn uxToolbarButton';
    button.id = 'themeToggle';
    button.type = 'button';
    button.addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));
    actions.insertBefore(button, actions.firstChild);
    setTheme(localStorage.getItem('scenarioTheme') || 'dark', false);
  }

  function addModuleIntros() {
    Object.entries(intros).forEach(([id, html]) => {
      const view = document.getElementById(id);
      if (!view || view.querySelector(':scope > .moduleIntro')) return;
      const intro = document.createElement('div');
      intro.className = 'moduleIntro';
      intro.innerHTML = html;
      view.prepend(intro);
    });
  }

  function marketMarkup() {
    const cards = marketAssets.map((asset) => `
      <article class="marketExplorerCard" data-market-card="${asset.symbol}">
        <div class="marketExplorerHead">
          <div class="marketIdentity"><div class="marketToken">${asset.code}</div><div><b>${asset.name}</b><small>${asset.code}/USDT · Binance Spot</small></div></div>
          <span class="marketChange" data-market-change>--</span>
        </div>
        <strong class="marketPrice" data-market-price>Cargando…</strong>
        <div class="marketFacts">
          <div><span>24h High</span><b data-market-high>--</b></div>
          <div><span>24h Low</span><b data-market-low>--</b></div>
          <div><span>Volumen</span><b data-market-volume>--</b></div>
        </div>
      </article>`).join('');
    return `
      <section class="view" id="markets" tabindex="-1" aria-label="Mercados públicos" aria-hidden="true">
        <div class="moduleIntro"><b>Mercados públicos:</b> comparación rápida de BTC, ETH y BNB usando Binance Spot. Esta vista amplía contexto de mercado, no reutiliza el modelo BTC sobre otros activos.</div>
        <article class="panel content">
          <div class="ey">Explorador multi-activo · sólo lectura</div>
          <h2>Mercados cripto</h2>
          <p class="tiny">Precios y estadísticas públicas. Sin credenciales privadas, sin órdenes y sin endpoints de trading.</p>
          <div class="marketExplorerGrid">${cards}</div>
          <div class="marketScopeNote"><strong>Alcance Quant actual:</strong> V5.9.0, Auto-Paper y la Prueba 90D siguen formalmente calibrados para BTC/USDT. ETH y BNB entran primero como observación de mercado; tendrán modelo propio sólo después de dataset, calibración y validación fuera de muestra.</div>
        </article>
      </section>`;
  }

  function ensureMarketRefreshTimer() {
    if (marketRefreshTimer) return;
    marketRefreshTimer = setInterval(() => {
      if ($('#markets')?.classList.contains('active')) void refreshMarkets();
    }, 30000);
  }

  function openMarkets() {
    openView('markets');
    void refreshMarkets();
    ensureMarketRefreshTimer();
  }

  function addMarketNavButton(container, { beforeSelector = null, compact = false } = {}) {
    if (!container || container.querySelector('[data-view="markets"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'markets';
    if (compact) {
      button.textContent = 'Mercados';
      button.setAttribute('aria-label', 'Mercados. BTC, ETH y BNB en Binance Spot');
      button.title = 'Mercados · BTC, ETH y BNB';
    } else {
      formatNavigationButton(button);
    }
    const before = beforeSelector ? container.querySelector(beforeSelector) : null;
    if (before) container.insertBefore(button, before);
    else container.append(button);
    button.addEventListener('click', openMarkets);
  }

  function addMarketsView() {
    if (!$('#markets')) {
      const systemView = $('#system');
      if (!systemView) return;
      systemView.insertAdjacentHTML('beforebegin', marketMarkup());
    }
    addMarketNavButton($('.nav'), { beforeSelector: '[data-view="analytics"]' });
    addMarketNavButton($('.mobileNav'), { beforeSelector: '[data-view="analytics"]', compact: true });
  }

  function fmtUsd(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    const digits = n < 10 ? 3 : n < 1000 ? 2 : 0;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', maximumFractionDigits: digits }).format(n);
  }

  function fmtVolume(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '--';
    return new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 }).format(n) + ' USDT';
  }

  async function fetchTicker(asset) {
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(asset.symbol)}`, {
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function renderMarket(asset, data, error = null) {
    const card = document.querySelector(`[data-market-card="${asset.symbol}"]`);
    if (!card) return;
    card.classList.remove('isUp', 'isDown', 'isError');
    if (error) {
      card.classList.add('isError');
      $('[data-market-price]', card).textContent = 'No disponible';
      $('[data-market-change]', card).textContent = '--';
      return;
    }
    const change = Number(data.priceChangePercent);
    card.classList.add(change >= 0 ? 'isUp' : 'isDown');
    $('[data-market-price]', card).textContent = fmtUsd(data.lastPrice);
    $('[data-market-change]', card).textContent = Number.isFinite(change) ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '--';
    $('[data-market-high]', card).textContent = fmtUsd(data.highPrice);
    $('[data-market-low]', card).textContent = fmtUsd(data.lowPrice);
    $('[data-market-volume]', card).textContent = fmtVolume(data.quoteVolume);
  }

  async function refreshMarkets() {
    if (!document.body.classList.contains('auth-granted')) return;
    await Promise.all(marketAssets.map(async (asset) => {
      try { renderMarket(asset, await fetchTicker(asset)); }
      catch (error) { renderMarket(asset, null, error); }
    }));
  }

  function annotateMetrics() {
    const notes = {
      analyticsBA: 'Balanced Accuracy: equilibrio de acierto entre clases, útil cuando una clase domina la muestra.',
      analyticsECE: 'Expected Calibration Error: distancia entre probabilidades declaradas y frecuencia observada.',
      analyticsBSS: 'Brier Skill Score: mejora o deterioro frente a un baseline probabilístico.',
      trialCounter: 'Sólo avanzan días completos con ledger, checkpoint y evidencia verificable.',
    };
    Object.entries(notes).forEach(([id, text]) => {
      const node = document.getElementById(id);
      if (node) node.title = text;
    });
  }

  function scheduleGuidedUx() {
    if (guidedLoadScheduled || new URLSearchParams(location.search).get('qa') === 'performance') return;
    guidedLoadScheduled = true;
    const load = () => setTimeout(() => import('./onboarding.js').catch(() => {}), 650);
    if (document.body.classList.contains('auth-granted')) load();
    else window.addEventListener('btc:auth-granted', load, { once: true });
  }

  function init() {
    setTheme(localStorage.getItem('scenarioTheme') || 'dark', false);
    applyBrand();
    addMarketsView();
    enhanceNavigation();
    addThemeToggle();
    addModuleIntros();
    annotateMetrics();
    scheduleGuidedUx();
    window.addEventListener('btc:auth-granted', () => {
      if ($('#markets')?.classList.contains('active')) void refreshMarkets();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
