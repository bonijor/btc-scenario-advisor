const readinessSnapshot = Object.freeze({
  evidenceAsOf: '2026-09-03T09:17:13.501Z',
  gates: Object.freeze({
    data: Object.freeze({ state: 'PASS', detail: 'Gate 1 conectado · trazabilidad 5m/15m validada' }),
    economics: Object.freeze({ state: 'COLLECTING', detail: '12 outcomes · 0 activados · calibración pendiente' }),
    formal90d: Object.freeze({ state: 'VERIFIED 16/90', detail: 'Integridad PASS · 74 días pendientes' }),
    risk: Object.freeze({ state: 'BLOCKED', detail: 'Sin candidato económico calibrado' }),
    execution: Object.freeze({ state: 'BLOCKED', detail: 'Cuenta live y ejecución no verificadas' }),
  }),
  economics: Object.freeze({ labeled: 12, pending: 8, activated: 0, minimumSamples: 100, minimumActivated: 50 }),
  trial: Object.freeze({ completed: 16, required: 90, status: 'RECONCILED_FORMAL_90D_READONLY' }),
});

function gateClass(state) {
  const value = String(state || '').toUpperCase();
  if (value === 'PASS') return 'pass';
  if (value.startsWith('VERIFIED')) return 'verified';
  if (value === 'COLLECTING') return 'collecting';
  return 'blocked';
}

function renderReadinessV3() {
  const root = document.getElementById('liveReadinessV3');
  if (!root) return;
  const gates = readinessSnapshot.gates;
  for (const [key, gate] of Object.entries(gates)) {
    const card = root.querySelector(`[data-gate="${key}"]`);
    if (!card) continue;
    card.classList.remove('pass', 'verified', 'collecting', 'blocked');
    card.classList.add(gateClass(gate.state));
    card.querySelector('strong').textContent = gate.state;
    card.querySelector('small').textContent = gate.detail;
  }
  const put = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  put('readinessOverall', 'LIVE_READY = FALSE');
  put('readinessEvidenceAt', new Date(readinessSnapshot.evidenceAsOf).toLocaleString('es-AR', { hour12: false }));
  put('readinessTrial', `${readinessSnapshot.trial.completed} / ${readinessSnapshot.trial.required}`);
  put('readinessEconomics', `${readinessSnapshot.economics.labeled} outcomes · ${readinessSnapshot.economics.activated} activados`);
  put('readinessMirror', 'NO DISPONIBLE');
}

window.addEventListener('DOMContentLoaded', renderReadinessV3);
