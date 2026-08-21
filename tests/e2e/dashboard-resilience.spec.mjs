import { test, expect } from '@playwright/test';

const TRIAL_ID = 'btc-shadow-90d-20260817T173948Z';

function dashboardFixture(now = Date.now()) {
  return {
    apiVersion: 'btc-shadow-dashboard-readonly/2.0',
    generatedAt: new Date(now).toISOString(),
    mode: 'SHADOW',
    spotOnly: true,
    automaticExecution: false,
    runtime: {
      ready: true,
      shadowMode: true,
      operationMode: 'SPOT_ONLY',
      allowShort: false,
      modelVersion: 'V5.9.0-SPOT-HIGH-CONVICTION',
      revision: 'btc-shadow-engine-90d-qa-fixture',
      lastSuccessfulCycleAt: now - 12_000,
      errorState: 'NONE',
    },
    trial: {
      trialId: TRIAL_ID,
      requiredDays: 90,
      completedDays: 2,
      remainingDays: 88,
      firstCompleteDay: '2026-08-18',
      manifestDigest: '757422dbd20fead8503f0545766f06b5df020c78eab2bf036d72c5f72ef9fd03',
      status: 'VERIFIED',
    },
    decisions: [],
    paper: {
      status: 'WAITING_CONDITIONS',
      funnel: {
        counts: {
          observed: 5,
          officialHorizon: 2,
          bullishBias: 2,
          highConfidence: 0,
          eligible: 0,
        },
        rejectedByReason: {
          HORIZON_NOT_ELIGIBLE: 3,
          HIGH_CONFIDENCE_REQUIRED: 2,
        },
        lifecycle: { alreadySeen: 0, opened: 0, verified: 0 },
      },
      paper: {
        activeOpen: 0,
        verified: 0,
        metrics: {
          verifiedTrades: 0,
          wins: 0,
          losses: 0,
          winRatePct: null,
          netReturnPct: null,
        },
        trades: [],
      },
    },
  };
}

async function installMarketRoutes(page) {
  await page.route(/\/api\/v3\/ticker\/24hr(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ lastPrice: '116000', priceChangePercent: '1.2', highPrice: '117000', lowPrice: '115000', quoteVolume: '1000000' }),
  }));
  await page.route(/\/api\/v3\/klines(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([[Date.now(), '116000', '116100', '115900', '116050', '10']]),
  }));
}

test('keeps last verified 90D and funnel snapshot when API becomes unavailable', async ({ page }) => {
  let dashboardOnline = true;
  await installMarketRoutes(page);
  await page.route(/\/api\/v1\/dashboard(?:\?|$)/, async (route) => {
    if (dashboardOnline) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboardFixture()) });
      return;
    }
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false }) });
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#trialCounter')).toHaveText('2 / 90');
  await expect(page.locator('#trialState')).toContainText('VERIFIED');
  await expect(page.locator('#funnelObserved')).toHaveText('5');
  await expect(page.locator('#funnelOfficial')).toHaveText('2');
  await expect(page.locator('#funnelBullish')).toHaveText('2');
  await expect(page.locator('#funnelEligible')).toHaveText('0');

  dashboardOnline = false;
  await page.locator('#refresh').click();
  await expect(page.locator('#apiStatus')).toHaveText('OFFLINE');
  await expect(page.locator('#trialCounter')).toHaveText('2 / 90');
  await expect(page.locator('#funnelObserved')).toHaveText('5');
  await expect(page.locator('#runtimeChip')).toContainText('ÚLTIMO DATO VERIFICADO');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#apiStatus')).toHaveText('OFFLINE');
  await expect(page.locator('#trialCounter')).toHaveText('2 / 90');
  await expect(page.locator('#trialState')).toContainText('VERIFIED');
  await expect(page.locator('#funnelObserved')).toHaveText('5');
});

test('never presents 0/90 as verified progress before the API or cache has answered', async ({ page }) => {
  await installMarketRoutes(page);
  await page.route(/\/api\/v1\/dashboard(?:\?|$)/, (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#trialCounter')).toHaveText('-- / 90');
  await expect(page.locator('#trialDays')).toHaveText('evidencia no disponible');
  await expect(page.locator('#apiStatus')).toHaveText('OFFLINE');
});
