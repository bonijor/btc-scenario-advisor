import test from 'node:test';
import assert from 'node:assert/strict';
import { readVerifiedSnapshot, saveVerifiedSnapshot, snapshotIsSafe } from '../assets/dashboard-resilience.js';

const TRIAL_ID = 'btc-shadow-90d-20260817T173948Z';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

function fixture(status = 'VERIFIED') {
  return {
    apiVersion: 'btc-shadow-dashboard-readonly/2.0',
    generatedAt: '2026-09-04T13:00:00.000Z',
    mode: 'SHADOW',
    spotOnly: true,
    automaticExecution: false,
    firebaseToken: 'must-not-persist',
    account: { email: 'must-not-persist@example.invalid' },
    runtime: { shadowMode: true, operationMode: 'SPOT_ONLY', allowShort: false, ready: true },
    trial: { trialId: TRIAL_ID, status, completedDays: 16, requiredDays: 90 },
    decisions: Array.from({ length: 30 }, (_, i) => ({ horizon: '5m', reason: `r${i}` })),
    paper: {
      status: 'WAITING_CONDITIONS',
      recentRuns: [{ runId: 'must-not-persist' }],
      funnel: { counts: { observed: 5, eligible: 0 } },
      paper: { activeOpen: 0, verified: 0, metrics: { verifiedTrades: 0 }, trades: [] },
    },
  };
}

test('only VERIFIED formal trial snapshots satisfy cache trust boundary', () => {
  assert.equal(snapshotIsSafe(fixture('VERIFIED'), TRIAL_ID), true);
  assert.equal(snapshotIsSafe(fixture('INITIALIZED'), TRIAL_ID), false);
  assert.equal(snapshotIsSafe(fixture('BLOCKED'), TRIAL_ID), false);
});

test('unsafe runtime and wrong trial fail closed', () => {
  const unsafe = fixture();
  unsafe.runtime.allowShort = true;
  assert.equal(snapshotIsSafe(unsafe, TRIAL_ID), false);
  assert.equal(snapshotIsSafe(fixture(), 'wrong-trial'), false);
});

test('cache persists bounded projection without arbitrary auth/account fields', () => {
  const s = storage();
  assert.equal(saveVerifiedSnapshot(s, 'k', fixture(), TRIAL_ID, 90, 1000), true);
  const raw = s.getItem('k');
  assert.ok(raw);
  assert.equal(raw.includes('must-not-persist'), false);
  assert.equal(raw.includes('recentRuns'), false);
  const cached = JSON.parse(raw);
  assert.equal(cached.data.decisions.length, 15);
  assert.equal(cached.data.paper.funnel.counts.observed, 5);
});

test('non-verified snapshots are never written', () => {
  const s = storage();
  assert.equal(saveVerifiedSnapshot(s, 'k', fixture('INITIALIZED'), TRIAL_ID, 90, 1000), false);
  assert.equal(s.getItem('k'), null);
});

test('expired, future-dated, corrupt, or unsafe cache is rejected and removed', () => {
  const now = 2_000_000_000;
  const cases = [
    JSON.stringify({ savedAt: now - (24 * 60 * 60 * 1000) - 1, data: fixture() }),
    JSON.stringify({ savedAt: now + 60_001, data: fixture() }),
    '{bad json',
    JSON.stringify({ savedAt: now - 1000, data: fixture('BLOCKED') }),
  ];
  for (const value of cases) {
    const s = storage();
    s.setItem('k', value);
    assert.equal(readVerifiedSnapshot(s, 'k', TRIAL_ID, 90, now), null);
    assert.equal(s.getItem('k'), null);
  }
});

test('fresh VERIFIED cache remains readable', () => {
  const now = 2_000_000_000;
  const s = storage();
  s.setItem('k', JSON.stringify({ savedAt: now - 1000, data: fixture() }));
  assert.equal(readVerifiedSnapshot(s, 'k', TRIAL_ID, 90, now)?.trial.completedDays, 16);
});
