import { createHash } from 'node:crypto';

const HORIZONS = new Set(['5m', '15m', '1h', '4h', '1d', '1w', '1m']);

export function validateAdviEvidence(payload, { trialId, maxAgeMs = 15 * 60 * 1000, now = Date.now() } = {}) {
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'MISSING_EVIDENCE' };
  const runtime = payload.runtime || {};
  const trial = payload.trial || {};
  const generatedAt = Date.parse(payload.generatedAt || '');

  if (runtime.shadowMode !== true || runtime.operationMode !== 'SPOT_ONLY' || runtime.allowShort !== false) {
    return { ok: false, reason: 'UNSAFE_RUNTIME' };
  }
  if (payload.automaticExecution === true) return { ok: false, reason: 'AUTOMATIC_EXECUTION_ENABLED' };
  if (trialId && trial.trialId !== trialId) return { ok: false, reason: 'TRIAL_ID_MISMATCH' };
  if (trial.status !== 'VERIFIED') return { ok: false, reason: 'TRIAL_NOT_VERIFIED' };
  if (!Number.isFinite(generatedAt)) return { ok: false, reason: 'INVALID_TIMESTAMP' };
  if (generatedAt > now + 60_000) return { ok: false, reason: 'FUTURE_TIMESTAMP' };
  if (now - generatedAt > maxAgeMs) return { ok: false, reason: 'STALE_EVIDENCE' };

  return { ok: true, reason: 'VERIFIED', generatedAt, trialId: trial.trialId };
}

export function createReadonlyDashboardAdapter(fetchImpl, { baseUrl, authHeaderProvider } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  const endpoint = new URL('/api/v1/dashboard', baseUrl);

  return async function readDashboard() {
    const headers = new Headers();
    if (authHeaderProvider) {
      const token = await authHeaderProvider();
      if (token) headers.set('x-btc-dashboard-authorization', token.startsWith('Bearer ') ? token : `Bearer ${token}`);
    }
    const response = await fetchImpl(endpoint, { method: 'GET', headers });
    if (!response.ok) throw new Error(`DASHBOARD_READ_FAILED_${response.status}`);
    return response.json();
  };
}

export function validateProbabilities(probabilities) {
  const values = ['up', 'down', 'sideways'].map((key) => Number(probabilities?.[key]));
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
    && Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) < 1e-9;
}

export function buildAdviRecord({ payload, horizon, probabilities, confidence = 'LOW', status = 'ADVISORY', now = new Date() }) {
  if (!HORIZONS.has(horizon)) throw new Error('INVALID_HORIZON');
  if (status === 'ADVISORY' && !validateProbabilities(probabilities)) throw new Error('INVALID_PROBABILITIES');
  const canonical = JSON.stringify({
    generatedAt: payload?.generatedAt ?? null,
    trial: payload?.trial ?? null,
    runtime: payload?.runtime ?? null,
    mode: payload?.mode ?? null,
  });
  return Object.freeze({
    agent: 'advi',
    version: '0.1',
    mode: 'READ_ONLY_SHADOW',
    generated_at: now.toISOString(),
    trial_id: payload?.trial?.trialId ?? null,
    horizon,
    input_fingerprint: createHash('sha256').update(canonical).digest('hex'),
    input_freshness: status === 'ADVISORY' ? 'VERIFIED' : 'BLOCKED',
    probabilities: status === 'ADVISORY' ? { ...probabilities } : { up: 0, down: 0, sideways: 100 },
    confidence,
    status,
    formal_trial_effect: 'NONE',
  });
}

export function createAppendOnlyAgentLedger() {
  const records = [];
  return Object.freeze({
    append(record) {
      if (!record || record.agent !== 'advi' || record.formal_trial_effect !== 'NONE') throw new Error('INVALID_AGENT_LEDGER_RECORD');
      records.push(Object.freeze({ ...record }));
      return records.length;
    },
    readAll() {
      return records.map((record) => ({ ...record }));
    },
  });
}

export async function runAdvi({ readDashboard, trialId, horizon, probabilities, confidence, now = Date.now(), maxAgeMs }) {
  const payload = await readDashboard();
  const gate = validateAdviEvidence(payload, { trialId, maxAgeMs, now });
  if (!gate.ok) {
    return buildAdviRecord({ payload, horizon, probabilities: null, confidence: 'LOW', status: 'BLOCKED', now: new Date(now) });
  }
  return buildAdviRecord({ payload, horizon, probabilities, confidence, status: 'ADVISORY', now: new Date(now) });
}
