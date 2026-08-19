(() => {
  'use strict';
  let pending;
  const load = () => pending || (pending = new Promise((resolve, reject) => {
    if (window.BTC_PRODUCT) { resolve(window.BTC_PRODUCT); return; }
    const script = document.createElement('script');
    script.src = 'assets/product.js';
    script.async = true;
    script.dataset.productModule = '1';
    script.onload = () => resolve(window.BTC_PRODUCT);
    script.onerror = reject;
    document.head.append(script);
  }));
  document.querySelectorAll('[data-view="account"]').forEach((button) => button.addEventListener('click', () => { void load(); }));
  if (document.getElementById('account')?.classList.contains('active')) void load();
  window.ScenarioProductLoader = Object.freeze({ load });
})();
