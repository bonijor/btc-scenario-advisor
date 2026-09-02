import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAdviRecord,
  createAppendOnlyAgentLedger,
  createReadonlyDashboardAdapter,
  runAdvi,
  validateAdviEvidence,
  validateProbabilities,
} from '../../agents/advi/advi.js';

const NOW = Date.parse('2026-09-02T18:30:00Z');
const safePayload = {
  generatedAt: '2026-09-02T18:29:00Z',
  mode: 'SHADOW',
  automaticExecution: false,
  runtime: { shadowMode: true, operationMode: 'SPOT_ONLY', allowShort: false },
  trial: { trialId: 'trial-safe', status: 'VERIFIED' },
};

test('accepts only verified fresh SHADOW/SPOT evidence', () => {
  assert.equal(validateAdviEvidence(safePayload, { trialId: 'trial-safe', now: NOW }).ok, true);
});

test('fails closed on unsafe runtime, mismatch and stale evidence', () => {
  assert.equal(validateAdviEvidence({ ...safePayload, runtime: { ...safePayload.runtime, allowShort: true } }, { trialId: 'trial-safe', now: NOW }).reason, 'UNSAFE_RUNTIME');
  assert.equal(validateAdviEvidence(safePayload, { trialId: 'other', now: NOW }).reason, 'TRIAL_ID_MISMATCH');
  assert.equal(validateAdviEvidence({ ...safePayload, generatedAt: '2026-09-02T17:00:00Z' }, { trialId: 'trial-safe', now: NOW }).reason, 'STALE_EVIDENCE');
});

test('dashboard adapter performs GET only and scopes auth to dashboard endpoint', async () => {
  let captured;
  const adapter = createReadonlyDashboardAdapter(async (url, options) => {
    captured = { url: String(url), options };
    return { ok: true, json: async () => safePayload };
  }, { baseUrl: 'https://example.invalid/', authHeaderProvider: async () => 'token' });
  await adapter();
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.url, 'https://example.invalid/api/v1/dashboard');
  assert.equal(captured.options.body, undefined);
  assert.equal(captured.options.headers.get('x-btc-dashboard-authorization'), 'Bearer token');
});

test('probabilities must be bounded and sum to 100', () => {
  assert.equal(validateProbabilities({ up: 40, down: 30, sideways: 30 }), true);
  assert.equal(validateProbabilities({ up: 60, down: 60, sideways: -20 }), false);
  assert.throws(() => buildAdviRecord({ payload: safePayload, horizon: '15m', probabilities: { up: 10, down: 10, sideways: 10 } }), /INVALID_PROBABILITIES/);
});

test('blocked run has no formal trial effect', async () => {
  const record = await runAdvi({
    readDashboard: async () => ({ ...safePayload, trial: { ...safePayload.trial, status: 'UNVERIFIED' } }),
    trialId: 'trial-safe', horizon: '15m', probabilities: { up: 50, down: 25, sideways: 25 }, now: NOW,
  });
  assert.equal(record.status, 'BLOCKED');
  assert.equal(record.formal_trial_effect, 'NONE');
});

test('agent ledger is append-only by interface and isolated from formal ledger', () => {
  const ledger = createAppendOnlyAgentLedger();
  const record = buildAdviRecord({ payload: safePayload, horizon: '15m', probabilities: { up: 40, down: 30, sideways: 30 }, now: new Date(NOW) });
  assert.equal(ledger.append(record), 1);
  assert.equal(ledger.readAll().length, 1);
  assert.equal(typeof ledger.update, 'undefined');
  assert.equal(typeof ledger.remove, 'undefined');
  assert.throws(() => ledger.append({ ...record, formal_trial_effect: 'INCREMENT' }), /INVALID_AGENT_LEDGER_RECORD/);
});
