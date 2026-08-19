(() => {
  const loadAutoPaper = () => {
    if (!document.querySelector('link[data-autopaper-module]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/paper-funnel.css?v=3d1';
      link.dataset.autopaperModule = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-autopaper-module]')) {
      const script = document.createElement('script');
      script.src = 'assets/paper-funnel.js?v=3d1';
      script.dataset.autopaperModule = 'true';
      script.async = false;
      document.head.appendChild(script);
    }
  };

  const kickResponsiveLayout = () => {
    window.dispatchEvent(new Event('resize'));
  };

  const settleResponsiveLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(kickResponsiveLayout));
    setTimeout(kickResponsiveLayout, 120);
    setTimeout(kickResponsiveLayout, 420);
  };

  loadAutoPaper();
  window.addEventListener('load', settleResponsiveLayout, { once: true });
  window.addEventListener('pageshow', settleResponsiveLayout);

  if (document.fonts?.ready) {
    document.fonts.ready.then(settleResponsiveLayout).catch(() => {});
  }
})();
