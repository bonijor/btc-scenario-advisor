import { test, expect } from '@playwright/test';

const intervalMs = { '1m': 60_000, '5m': 300_000, '15m': 900_000, '1d': 86_400_000 };

function dashboardFixture(now = Date.now()) {
  const decision = (horizon) => ({
    timestamp: new Date(now - 12_000).toISOString(), horizon, decision: 'NO_ACTUAR',
    signalQuality: 84, executionViability: 'BLOCKED_SHADOW', modelState: 'VALIDATED_SHADOW',
    reason: 'SHADOW_MODE,SPOT_ONLY,QA_FIXTURE', balancedAccuracy: 0.731, brierSkillScore: 0.118, ece: 0.041,
  });
  return {
    generatedAt: new Date(now).toISOString(), mode: 'SHADOW', spotOnly: true, automaticExecution: false,
    runtime: { ready: true, shadowMode: true, operationMode: 'SPOT_ONLY', allowShort: false, modelVersion: 'V5.9.0-SPOT-HIGH-CONVICTION', revision: 'data-pulse-qa', lastSuccessfulCycleAt: now - 12_000, errorState: 'NONE' },
    trial: { trialId: 'btc-shadow-90d-20260817T173948Z', requiredDays: 90, completedDays: 0, firstCompleteDay: '2026-08-18', status: 'INITIALIZED' },
    decisions: [decision('5m'), decision('15m')], paper: { simulatedTrades: 0, trades: [] },
  };
}

function closedKlines(interval) {
  const duration = intervalMs[interval] || intervalMs['5m'];
  const now = Date.now();
  const start = Math.floor((now - duration * 180) / duration) * duration;
  return Array.from({ length: 180 }, (_, index) => {
    const openTime = start + index * duration, open = 115_000 + index * 3, close = open + 12;
    return [openTime, String(open), String(close + 20), String(open - 20), String(close), '10', openTime + duration - 1];
  });
}

test('Data Pulse separates official horizons from public context and aggregates 45m from closed 15m candles', async ({ page }) => {
  const requestedIntervals = [];
  await page.route(/\/api\/v1\/dashboard(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboardFixture()) }));
  await page.route(/\/api\/v3\/ticker\/24hr(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ lastPrice: '116120.50', priceChangePercent: '1.42', highPrice: '117020', lowPrice: '113880', quoteVolume: '3180000000' }) }));
  await page.route(/\/api\/v3\/klines(?:\?|$)/, (route) => {
    const interval = new URL(route.request().url()).searchParams.get('interval') || '5m';
    requestedIntervals.push(interval);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(closedKlines(interval)) });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dataPulse')).toBeVisible();
  await expect(page.locator('.tfButton')).toHaveCount(5);
  await expect(page.locator('#pulseQuant')).toContainText('NO ACTUAR');
  await expect(page.locator('#pulseCloseAt')).not.toHaveText('No disponible');

  await page.locator('.tfButton[data-interval="1m"]').click();
  await expect(page.locator('#pulseQuant')).toHaveText('CONTEXTO PÚBLICO');
  await expect(page.locator('#pulseQuality')).toHaveText('No aplica');

  await page.locator('.tfButton[data-interval="45m"]').click();
  await expect(page.locator('#chartTf')).toHaveText('45m');
  await expect(page.locator('#pulseCloseAt')).not.toHaveText('No disponible');
  expect(requestedIntervals).toContain('15m');
});
