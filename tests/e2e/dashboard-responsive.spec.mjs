import { test, expect } from '@playwright/test';

const TRIAL_ID = 'btc-shadow-90d-20260817T173948Z';

function dashboardFixture(now = Date.now()) {
  const iso = new Date(now).toISOString();
  const decision = (horizon, quality, offset) => ({
    timestamp: new Date(now - offset).toISOString(),
    horizon,
    decision: 'NO_ACTUAR',
    signalQuality: quality,
    executionViability: 'BLOCKED_SHADOW',
    modelState: 'VALIDATED_SHADOW',
    reason: 'SHADOW_MODE,SPOT_ONLY,QA_FIXTURE',
    activation: '116250',
    invalidation: '115600',
    balancedAccuracy: 0.731,
    brierSkillScore: 0.118,
    ece: 0.041,
    evaluatedSamples: 420,
  });

  return {
    apiVersion: 'btc-shadow-dashboard-readonly/1.0',
    generatedAt: iso,
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
      completedDays: 0,
      remainingDays: 90,
      firstCompleteDay: '2026-08-18',
      manifestDigest: '757422dbd20fead8503f0545766f06b5df020c78eab2bf036d72c5f72ef9fd03',
      status: 'INITIALIZED',
    },
    decisions: [
      decision('1m', 78, 5_000),
      decision('5m', 84, 10_000),
      decision('15m', 87, 15_000),
      decision('45m', 82, 20_000),
      decision('1d', 80, 25_000),
    ],
    paper: {
      status: 'NO_VERIFIED_TRADES_PUBLISHED',
      simulatedTrades: 0,
      winRatePct: null,
      netPnlPct: null,
      drawdownPct: null,
      trades: [],
      note: 'QA fixture: no se infieren trades desde señales.',
    },
  };
}

function tickerFixture() {
  return {
    symbol: 'BTCUSDT',
    lastPrice: '116120.50',
    priceChangePercent: '1.42',
    highPrice: '117020.00',
    lowPrice: '113880.00',
    quoteVolume: '3180000000.00',
  };
}

function klineFixture() {
  const rows = [];
  const start = 116000;
  for (let i = 0; i < 140; i += 1) {
    const wave = Math.sin(i / 7) * 420 + Math.cos(i / 15) * 160;
    const open = start + wave + (i % 5) * 12;
    const close = open + Math.sin(i / 3) * 85;
    const high = Math.max(open, close) + 75 + (i % 3) * 8;
    const low = Math.min(open, close) - 70 - (i % 4) * 7;
    rows.push([
      1787000000000 + i * 300000,
      open.toFixed(2),
      high.toFixed(2),
      low.toFixed(2),
      close.toFixed(2),
      (120 + i).toFixed(2),
      1787000299999 + i * 300000,
      '0', 0, '0', '0', '0',
    ]);
  }
  return rows;
}

async function installDeterministicRoutes(page) {
  await page.route(/\/api\/v1\/dashboard(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dashboardFixture()) });
  });
  await page.route(/\/api\/v3\/ticker\/24hr(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(tickerFixture()) });
  });
  await page.route(/\/api\/v3\/klines(?:\?|$)/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(klineFixture()) });
  });
}

async function openDashboard(page) {
  await installDeterministicRoutes(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#engineState')).toHaveText('ONLINE');
  await expect(page.locator('#marketStatus')).toHaveText('ONLINE');
  await expect(page.locator('#trialCounter')).toContainText('/ 90');
  await expect(page.locator('#priceChart')).toBeVisible();
}

async function expectNoViewportOverflow(page) {
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    rootScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(geometry.rootScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
  expect(geometry.bodyScrollWidth).toBeLessThanOrEqual(geometry.innerWidth + 1);
}

async function readCanvasMetrics(page) {
  return page.locator('#priceChart').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    return {
      width: rect.width,
      height: rect.height,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      expectedWidth: Math.floor(rect.width * dpr),
      expectedHeight: Math.floor(rect.height * dpr),
      viewportWidth: window.innerWidth,
      dpr,
    };
  });
}

async function expectCanvasMatchesContainer(page) {
  let metrics = null;
  await expect.poll(async () => {
    metrics = await readCanvasMetrics(page);
    return Math.max(
      Math.abs(metrics.backingWidth - metrics.expectedWidth),
      Math.abs(metrics.backingHeight - metrics.expectedHeight),
    );
  }, {
    timeout: 5_000,
    intervals: [50, 100, 200, 400, 800],
    message: 'El backing buffer del canvas debe estabilizarse con su tamaño CSS y DPR actual',
  }).toBeLessThanOrEqual(3);

  expect(metrics.width).toBeGreaterThan(200);
  expect(metrics.height).toBeGreaterThan(180);
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewportWidth);
}

test.beforeEach(async ({ page }) => {
  await openDashboard(page);
});

test('overview stays inside viewport and chart is usable', async ({ page }) => {
  await expectNoViewportOverflow(page);
  await expectCanvasMatchesContainer(page);
  await expect(page.locator('#runtimeChip')).toContainText('MOTOR ONLINE');
  await expect(page.locator('#d5')).toHaveText('NO_ACTUAR');
  await expect(page.locator('#d15')).toHaveText('NO_ACTUAR');
});

test('navigation, analytics and wide tables remain contained', async ({ page }) => {
  await page.locator('[data-view="analytics"]:visible').first().click();
  await expect(page.locator('#analytics')).toBeVisible();
  await expect(page.locator('#analyticsBA')).not.toHaveText('--');
  await expectNoViewportOverflow(page);

  const analyticsTable = page.locator('#analytics .tableWrap');
  await expect(analyticsTable).toBeVisible();
  const tableGeometry = await analyticsTable.evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }));
  expect(tableGeometry.clientWidth).toBeGreaterThan(0);
  expect(tableGeometry.scrollWidth).toBeGreaterThanOrEqual(tableGeometry.clientWidth);

  await page.locator('[data-view="paper"]:visible').first().click();
  await expect(page.locator('#paper')).toBeVisible();
  await expect(page.locator('#tradesBody')).toContainText('Sin trades simulados verificados');
  await expectNoViewportOverflow(page);
});

test('responsive breakpoint redraws canvas after live resize', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium-1920', 'Live resize gate runs once on Chromium desktop.');

  const before = await readCanvasMetrics(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobileNav')).toBeVisible();
  await expect.poll(async () => page.locator('#priceChart').evaluate((canvas) => canvas.getBoundingClientRect().width)).toBeLessThan(before.width);
  await expectNoViewportOverflow(page);
  await expectCanvasMatchesContainer(page);

  const after = await readCanvasMetrics(page);
  expect(after.backingWidth).not.toBe(before.backingWidth);
});

test('captures QA evidence screenshots', async ({ page }, testInfo) => {
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: true });
  await page.locator('[data-view="analytics"]:visible').first().click();
  await expect(page.locator('#analytics')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('analytics.png'), fullPage: true });
});
