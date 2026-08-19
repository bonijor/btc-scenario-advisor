(() => {
  let autoPaperLoading = null;

  const loadAutoPaper = () => {
    if (window.BTCAutoPaper) return Promise.resolve(window.BTCAutoPaper);
    if (autoPaperLoading) return autoPaperLoading;

    autoPaperLoading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-autopaper-module]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'assets/paper-funnel.css?v=3d2';
        link.dataset.autopaperModule = 'true';
        document.head.appendChild(link);
      }

      const existing = document.querySelector('script[data-autopaper-module]');
      if (existing) {
        if (window.BTCAutoPaper) resolve(window.BTCAutoPaper);
        else {
          existing.addEventListener('load', () => resolve(window.BTCAutoPaper), { once: true });
          existing.addEventListener('error', reject, { once: true });
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'assets/paper-funnel.js?v=3d2';
      script.dataset.autopaperModule = 'true';
      script.async = true;
      script.addEventListener('load', () => {
        const paperNav = document.querySelector('[data-view="paper"]');
        if (paperNav) paperNav.textContent = '◎ Simulaciones';
        resolve(window.BTCAutoPaper);
      }, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });

    return autoPaperLoading;
  };

  const bindAutoPaperLazyLoad = () => {
    document.querySelectorAll('[data-view="paper"]').forEach((button) => {
      button.addEventListener('click', () => {
        loadAutoPaper().catch(() => {});
      }, { passive: true });
    });
  };

  const kickResponsiveLayout = () => {
    window.dispatchEvent(new Event('resize'));
  };

  const settleResponsiveLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(kickResponsiveLayout));
    setTimeout(kickResponsiveLayout, 120);
    setTimeout(kickResponsiveLayout, 420);
  };

  bindAutoPaperLazyLoad();
  window.addEventListener('load', settleResponsiveLayout, { once: true });
  window.addEventListener('pageshow', settleResponsiveLayout);

  if (document.fonts?.ready) {
    document.fonts.ready.then(settleResponsiveLayout).catch(() => {});
  }
})();
