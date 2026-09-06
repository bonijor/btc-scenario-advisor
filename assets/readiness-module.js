(() => {
  'use strict';
  // Historical, dated evidence from Visual V3. Never a live approval or a counter.
  const S = Object.freeze({
    evidenceAsOf: '2026-09-03T09:17:13.501Z',
    gates: {
      data: ['PASS', 'Gate 1 conectado \u00b7 trazabilidad 5m/15m validada', 'pass'],
      economics: ['COLLECTING', '12 outcomes \u00b7 0 activados \u00b7 calibraci\u00f3n pendiente', 'collecting'],
      formal90d: ['VERIFIED 16/90', 'Integridad PASS \u00b7 74 d\u00edas pendientes', 'verified'],
      risk: ['BLOCKED', 'Sin candidato econ\u00f3mico calibrado', 'blocked'],
      execution: ['BLOCKED', 'Cuenta live y ejecuci\u00f3n no verificadas', 'blocked'],
    },
    economics: { labeled: 12, activated: 0 },
    trial: { completed: 16, required: 90 },
  });
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  let pending = null;
  let requested = false;
  let origin = null;
  let notice = null;

  function announce(message) {
    if (!notice) {
      notice = document.createElement('p');
      notice.className = 'tiny';
      notice.id = 'readinessLoadStatus';
      notice.setAttribute('role', 'status');
    }
    origin?.insertAdjacentElement('afterend', notice);
    notice.textContent = message;
  }

  function loadStyles() {
    return new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'assets/live-readiness-v3.css';
      css.dataset.readinessModule = '1';
      const finish = (error) => {
        clearTimeout(timeout);
        css.onload = css.onerror = null;
        if (error) { css.remove(); reject(error); }
        else resolve(css);
      };
      const timeout = setTimeout(() => finish(new Error('READINESS_STYLE_TIMEOUT')), 10000);
      css.onload = () => finish();
      css.onerror = () => finish(new Error('READINESS_STYLE_UNAVAILABLE'));
      document.head.append(css);
    });
  }

  function mount() {
    if (q('#readiness')) return Promise.resolve();
    if (pending) return pending;
    qa('[data-view="readiness"]').forEach((b) => b.setAttribute('aria-busy', 'true'));
    pending = (async () => {
      const css = await loadStyles();
      try {
        // Yield before constructing the hidden panel; no panel work on startup.
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (q('#readiness')) return;
        const trial = q('#trial');
        if (!trial) throw new Error('READINESS_MOUNT_MISSING');
        const s = document.createElement('section');
        s.className = 'view';
        s.id = 'readiness';
        s.tabIndex = -1;
        s.setAttribute('aria-label', 'Estado operativo');
        s.setAttribute('aria-hidden', 'true');
        s.innerHTML = `<article class="panel readinessPanel" id="liveReadinessV3"><div class="readinessHead"><div><div class="ey">Estado verificable</div><h2>Readiness operativo</h2><p class="tiny">Vista read-only de los gates que deben cumplirse antes de cualquier habilitaci\u00f3n operativa.</p></div><div class="readinessOverall"><span>Estado global</span><strong>LIVE_READY = FALSE</strong><small>\u00d3rdenes reales bloqueadas</small></div></div><div class="readinessGrid">${Object.entries(S.gates).map(([k, v]) => `<article class="readinessGate ${v[2]}" data-gate="${k}"><span>${k === 'formal90d' ? 'FORMAL 90D' : k.toUpperCase()}</span><strong>${v[0]}</strong><small>${v[1]}</small></article>`).join('')}</div><div class="readinessMeta"><div><span>Trial formal</span><b>${S.trial.completed} / ${S.trial.required}</b><small>74 d\u00edas pendientes</small></div><div><span>Gate 2</span><b>${S.economics.labeled} outcomes \u00b7 ${S.economics.activated} activados</b><small>100 muestras / 50 activadas requeridas por segmento</small></div><div><span>Orden espejo</span><b>NO DISPONIBLE</b><small>Gate ECONOMICS pendiente</small></div><div><span>Evidencia al</span><b>${new Date(S.evidenceAsOf).toLocaleString('es-AR', { hour12: false })}</b><small>Snapshot fechado</small></div></div><p class="tiny readinessDisclaimer">SHADOW_MODE \u00b7 SPOT_ONLY \u00b7 online learning OFF \u00b7 SELL/short bloqueados \u00b7 REAL_ORDER_CREATED=false.</p></article>`;
        trial.insertAdjacentElement('afterend', s);
      } catch (error) {
        css.remove();
        throw error;
      }
    })().finally(() => {
      pending = null;
      qa('[data-view="readiness"]').forEach((b) => b.setAttribute('aria-busy', 'false'));
    });
    return pending;
  }

  async function open() {
    requested = true;
    announce('Cargando Estado Operativo...');
    try {
      await mount();
      if (!requested) return;
      // Consume the request once, including rapid repeated clicks.
      requested = false;
      window.BTCDashboardNavigation?.open('readiness');
      qa('.view').forEach((v) => {
        const active = v.id === 'readiness';
        v.classList.toggle('active', active);
        v.setAttribute('aria-hidden', String(!active));
      });
      qa('[data-view]').forEach((b) => {
        const active = b.dataset.view === 'readiness';
        b.classList.toggle('active', active);
        if (active) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
      });
      if (location.hash !== '#readiness') history.pushState({ view: 'readiness' }, '', '#readiness');
      q('#readiness')?.focus({ preventScroll: true });
      announce('');
    } catch {
      if (requested) announce('No se pudo cargar Estado Operativo. Volv\u00e9 a pulsar para reintentar.');
    }
  }

  function init() {
    if (q('[data-readiness-control]')) return;
    const trialButton = q('.nav [data-view="trial"]');
    const system = q('#system .content');
    for (const target of [trialButton, system]) {
      if (!target) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = '\u25c8 Estado Operativo';
      b.dataset.view = 'readiness';
      b.dataset.readinessControl = '1';
      if (target === system) { b.className = 'btn'; target.append(b); }
      else target.insertAdjacentElement('afterend', b);
    }
    // Capture before the generic router: the target section may not exist yet.
    document.addEventListener('click', (event) => {
      const b = event.target.closest?.('[data-view]');
      if (!b) return;
      if (b.dataset.view !== 'readiness') { requested = false; announce(''); return; }
      event.preventDefault();
      event.stopImmediatePropagation();
      origin = b;
      void open();
    }, true);
    const followHash = () => {
      requested = location.hash === '#readiness';
      if (requested) { origin = trialButton; void open(); }
    };
    window.addEventListener('hashchange', followHash);
    window.addEventListener('popstate', followHash);
    followHash();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
