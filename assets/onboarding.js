(() => {
  'use strict';

  const TOUR_KEY = 'scenarioOnboardingV1';
  const MODE_KEY = 'scenarioReadingModeV1';
  const steps = Object.freeze([
    { view: 'overview', title: '1. Empezá por Resumen', text: 'Acá ves el precio, el estado operativo y las decisiones 5m/15m. El detalle vive en secciones complementarias para evitar información repetida.' },
    { view: 'markets', title: '2. Mirá el contexto de mercado', text: 'Mercados compara BTC, ETH y BNB con datos públicos de Binance Spot. ETH y BNB son contexto read-only: todavía no usan el modelo Quant formal de BTC.' },
    { view: 'analytics', title: '3. Revisá la calidad', text: 'Análisis explica si las probabilidades están bien calibradas. BA, Brier, BSS y ECE sirven para medir calidad; ninguna métrica aislada garantiza una operación.' },
    { view: 'paper', title: '4. Entendé por qué opera o se abstiene', text: 'Simulaciones muestra el funnel completo. Una señal bloqueada puede ser una buena decisión: sólo una entrada y salida Paper verificadas cuentan como trade.' },
    { view: 'trial', title: '5. Separá continuidad de rentabilidad', text: 'La Prueba 90D valida evidencia, continuidad e inmutabilidad. Un día verificado confirma integridad operativa, no que el sistema haya ganado dinero ese día.' },
  ]);

  let current = 0;
  let lastFocus = null;
  const $ = (selector, root = document) => root.querySelector(selector);

  function injectStyles() {
    if ($('#scenarioGuideStyles')) return;
    const style = document.createElement('style');
    style.id = 'scenarioGuideStyles';
    style.textContent = `
      .scenarioGuideBackdrop{position:fixed;inset:0;z-index:120;background:rgba(2,7,14,.68);backdrop-filter:blur(7px);display:grid;place-items:center;padding:18px}
      .scenarioGuideBackdrop[hidden]{display:none}.scenarioGuideCard{width:min(520px,100%);border:1px solid var(--line2);background:linear-gradient(180deg,var(--panel),var(--panel2));border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.36);padding:22px;color:var(--text)}
      .scenarioGuideTop{display:flex;align-items:center;justify-content:space-between;gap:12px}.scenarioGuideKicker{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--blue);font-weight:950}.scenarioGuideProgress{font-size:9px;color:var(--muted)}
      .scenarioGuideCard h2{margin:14px 0 8px;font-size:22px}.scenarioGuideCard p{margin:0;color:var(--muted);font-size:12px;line-height:1.65}.scenarioGuideSafety{margin-top:15px;padding:10px 12px;border:1px solid rgba(41,211,145,.18);background:rgba(41,211,145,.05);border-radius:11px;color:var(--muted);font-size:9px;line-height:1.5}
      .scenarioGuideActions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:18px}.scenarioGuideActions button{min-height:40px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--text);padding:8px 12px;font-weight:850;cursor:pointer}.scenarioGuideActions .primary{border:0;background:linear-gradient(135deg,var(--blue),var(--blue2));color:#fff}.scenarioGuideActions .quiet{margin-right:auto;color:var(--muted)}
      body[data-reading-mode="simple"] [data-reading-detail="technical"]{display:none!important}.readingModeNote{display:none;margin:0 0 10px;padding:9px 11px;border:1px dashed var(--line);border-radius:10px;color:var(--muted);font-size:9px;line-height:1.45}body[data-reading-mode="simple"] .readingModeNote{display:block}
      @media(max-width:560px){.scenarioGuideBackdrop{align-items:end;padding:10px}.scenarioGuideCard{padding:18px;border-radius:17px}.scenarioGuideCard h2{font-size:19px}.scenarioGuideActions button{flex:1 1 auto}.scenarioGuideActions .quiet{flex-basis:100%;order:3}}
    `;
    document.head.append(style);
  }

  function visibleNav(view) {
    return [...document.querySelectorAll(`[data-view="${view}"]`)].find((node) => node.getClientRects().length) || document.querySelector(`[data-view="${view}"]`);
  }

  function goToView(view) {
    const button = visibleNav(view);
    if (button) button.click();
  }

  function ensureReadingModeNote() {
    const overview = $('#overview');
    if (!overview || overview.querySelector(':scope > .readingModeNote')) return;
    const note = document.createElement('div');
    note.className = 'readingModeNote';
    note.innerHTML = '<b>Vista simple activa.</b> Ocultamos runtime y pipelines técnicos. Podés volver a “Vista técnica” cuando quieras; ningún dato se elimina.';
    overview.prepend(note);
  }

  function markTechnicalDetails() {
    ['#system .runtimeBanner', '#analytics .explainDetails', '#system .dataPulse'].forEach((selector) => {
      const node = $(selector);
      if (node) node.dataset.readingDetail = 'technical';
    });
    ensureReadingModeNote();
  }

  function setReadingMode(mode, persist = true) {
    const value = mode === 'technical' ? 'technical' : 'simple';
    document.body.dataset.readingMode = value;
    if (persist) localStorage.setItem(MODE_KEY, value);
    const button = $('#readingModeToggle');
    if (button) {
      button.textContent = value === 'simple' ? '▤ Vista técnica' : '◫ Vista simple';
      button.title = value === 'simple' ? 'Mostrar runtime y detalles técnicos' : 'Priorizar la lectura ejecutiva';
      button.setAttribute('aria-pressed', String(value === 'technical'));
    }
  }

  function ensureToolbarControls() {
    const actions = $('.topActions');
    if (!actions) return;
    if (!$('#readingModeToggle')) {
      const mode = document.createElement('button');
      mode.id = 'readingModeToggle';
      mode.type = 'button';
      mode.className = 'btn uxToolbarButton';
      mode.addEventListener('click', () => setReadingMode(document.body.dataset.readingMode === 'simple' ? 'technical' : 'simple'));
      actions.insertBefore(mode, actions.firstChild);
    }
    if (!$('#guideToggle')) {
      const help = document.createElement('button');
      help.id = 'guideToggle';
      help.type = 'button';
      help.className = 'btn uxToolbarButton';
      help.textContent = '? Guía';
      help.setAttribute('aria-label', 'Abrir guía de uso');
      help.addEventListener('click', () => openGuide(0));
      actions.insertBefore(help, actions.firstChild);
    }
    setReadingMode(localStorage.getItem(MODE_KEY) || 'simple', false);
  }

  function guideMarkup() {
    return `
      <div class="scenarioGuideBackdrop" id="scenarioGuide" role="dialog" aria-modal="true" aria-labelledby="scenarioGuideTitle" hidden>
        <div class="scenarioGuideCard">
          <div class="scenarioGuideTop"><span class="scenarioGuideKicker">Scenario Advisor · recorrido rápido</span><span class="scenarioGuideProgress" id="scenarioGuideProgress"></span></div>
          <h2 id="scenarioGuideTitle"></h2><p id="scenarioGuideText"></p>
          <div class="scenarioGuideSafety">SHADOW only · SPOT_ONLY · la guía no ejecuta operaciones ni modifica el motor. ETH y BNB permanecen como mercado read-only hasta tener validación Quant propia.</div>
          <div class="scenarioGuideActions">
            <button class="quiet" id="scenarioGuideSkip" type="button">Omitir guía</button>
            <button id="scenarioGuidePrev" type="button">Anterior</button>
            <button class="primary" id="scenarioGuideNext" type="button">Siguiente</button>
          </div>
        </div>
      </div>`;
  }

  function renderStep() {
    const step = steps[current];
    if (!step) return;
    $('#scenarioGuideTitle').textContent = step.title;
    $('#scenarioGuideText').textContent = step.text;
    $('#scenarioGuideProgress').textContent = `${current + 1} / ${steps.length}`;
    $('#scenarioGuidePrev').disabled = current === 0;
    $('#scenarioGuideNext').textContent = current === steps.length - 1 ? 'Terminar' : 'Siguiente';
    goToView(step.view);
  }

  function closeGuide({ completed = true } = {}) {
    const dialog = $('#scenarioGuide');
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.body.style.removeProperty('overflow');
    if (completed) localStorage.setItem(TOUR_KEY, 'done');
    lastFocus?.focus?.({ preventScroll: true });
  }

  function openGuide(index = 0) {
    const dialog = $('#scenarioGuide');
    if (!dialog) return;
    lastFocus = document.activeElement;
    current = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    renderStep();
    $('#scenarioGuideNext')?.focus({ preventScroll: true });
  }

  function bindGuide() {
    $('#scenarioGuidePrev')?.addEventListener('click', () => { if (current > 0) { current -= 1; renderStep(); } });
    $('#scenarioGuideNext')?.addEventListener('click', () => {
      if (current >= steps.length - 1) { closeGuide({ completed: true }); return; }
      current += 1; renderStep();
    });
    $('#scenarioGuideSkip')?.addEventListener('click', () => closeGuide({ completed: true }));
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !$('#scenarioGuide')?.hidden) closeGuide({ completed: true });
    });
  }

  function init() {
    if ($('#scenarioGuide')) return;
    injectStyles();
    document.body.insertAdjacentHTML('beforeend', guideMarkup());
    markTechnicalDetails();
    ensureToolbarControls();
    bindGuide();
    const localQa = ['127.0.0.1', 'localhost'].includes(location.hostname);
    const qaOptIn = new URLSearchParams(location.search).get('onboarding') === '1';
    if (localStorage.getItem(TOUR_KEY) !== 'done' && (!localQa || qaOptIn)) setTimeout(() => openGuide(0), 450);
  }

  window.ScenarioGuidedUx = Object.freeze({ init, openGuide, setReadingMode });
  init();
})();
