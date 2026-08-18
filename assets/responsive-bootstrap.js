(() => {
  const kickResponsiveLayout = () => {
    window.dispatchEvent(new Event('resize'));
  };

  const settleResponsiveLayout = () => {
    requestAnimationFrame(() => requestAnimationFrame(kickResponsiveLayout));
    setTimeout(kickResponsiveLayout, 120);
    setTimeout(kickResponsiveLayout, 420);
  };

  window.addEventListener('load', settleResponsiveLayout, { once: true });
  window.addEventListener('pageshow', settleResponsiveLayout);

  if (document.fonts?.ready) {
    document.fonts.ready.then(settleResponsiveLayout).catch(() => {});
  }
})();
