import { test, expect } from '@playwright/test';

// The existing localhost-only QA path supplies deterministic data and auth.
// No production requests, user credentials, trial writes or execution endpoints.
async function openDashboard(page, hash = '') {
  await page.goto(`/?qa=performance${hash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toHaveClass(/auth-granted/);
  await expect(page.locator('[data-readiness-control]')).toHaveCount(2);
  await expect(page.locator('#themeToggle')).toBeVisible();
}

async function openSystem(page) {
  await page.locator('[data-view="system"]:visible').first().click();
  await expect(page.locator('#system')).toBeVisible();
  return page.locator('#system [data-view="readiness"]');
}

async function expectPanel(page) {
  const panel = page.locator('#readiness');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('aria-hidden', 'false');
  await expect(panel).toBeFocused();
  await expect(panel.locator('.readinessGate strong')).toHaveText(['PASS', 'COLLECTING', 'VERIFIED 16/90', 'BLOCKED', 'BLOCKED']);
  await expect(panel.locator('.readinessOverall strong')).toHaveText('LIVE_READY = FALSE');
  await expect(panel.locator('.readinessDisclaimer')).toContainText('REAL_ORDER_CREATED=false');
  await expect(panel.locator('.readinessMeta')).toContainText('Snapshot fechado');
  await expect(page.locator('#liveReadinessV3')).toHaveCount(1);
  await expect(page.locator('link[data-readiness-module]')).toHaveCount(1);
  await expect(page).toHaveURL(/#readiness$/);
}

test('V4 restores account, mobile navigation, Data Pulse and BI without eager Readiness render', async ({ page }) => {
  await openDashboard(page);
  await expect(page.locator('#readiness')).toHaveCount(0);
  await expect(page.locator('link[data-readiness-module]')).toHaveCount(0);
  await expect(page.locator('[data-auth-form="login"]')).toHaveCount(1);
  await expect(page.locator('[data-auth-form="register"]')).toHaveCount(1);
  await expect(page.locator('#preferencesForm')).toHaveCount(1);
  await expect(page.locator('#system .dataPulse')).toHaveCount(1);
  await expect(page.locator('#system a[href="bi-trading.html"]')).toHaveCount(1);
  await expect(page.locator('#gridEvidenceCount')).toHaveCount(0);
  if (page.viewportSize().width <= 900) await expect(page.locator('.mobileNav')).toBeVisible();
});

test('V4 Readiness opens on the first activation from desktop or mobile System', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDashboard(page);
  const button = await openSystem(page);
  await button.click();
  await expectPanel(page);
  await expect(page.locator('[data-readiness-control]').first()).toHaveAttribute('aria-busy', 'false');
  const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.width + 1);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('readiness-v4-first-open.png'), fullPage: true });
});

test('V4 keyboard activation and revisits keep a single Readiness panel', async ({ page }) => {
  await openDashboard(page);
  const button = await openSystem(page);
  await button.focus(); await button.press('Enter');
  await expectPanel(page);
  await page.locator('[data-view="overview"]:visible').first().click();
  await expect(page.locator('#overview')).toBeVisible();
  await (await openSystem(page)).click();
  await expectPanel(page);
});

test('V4 failed Readiness stylesheet is visible and retryable', async ({ page }) => {
  let attempts = 0;
  await page.route('**/assets/live-readiness-v3.css', async (route) => {
    attempts += 1;
    if (attempts === 1) await route.abort('failed');
    else await route.continue();
  });
  await openDashboard(page);
  const button = await openSystem(page);
  await button.click();
  await expect(page.locator('#readinessLoadStatus')).toContainText('reintentar');
  await expect(page.locator('#readiness')).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-busy', 'false');
  await button.click();
  await expectPanel(page);
  expect(attempts).toBe(2);
});

test('V4 repeated requests do not duplicate work or hijack later navigation', async ({ page }) => {
  let release;
  let requests = 0;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route('**/assets/live-readiness-v3.css', async (route) => {
    requests += 1;
    await held;
    await route.continue();
  });
  await openDashboard(page);
  const button = await openSystem(page);
  try {
    await button.click(); await button.click();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await page.locator('[data-view="overview"]:visible').first().click();
  } finally { release(); }
  await expect(page.locator('#liveReadinessV3')).toHaveCount(1);
  await expect(page.locator('#overview')).toBeVisible();
  await expect(page.locator('#readiness')).toBeHidden();
  expect(requests).toBe(1);
  await (await openSystem(page)).click();
  await expectPanel(page);
  expect(requests).toBe(1);
});

test('V4 deep link and back navigation open the deferred panel', async ({ page }) => {
  await openDashboard(page, '#readiness');
  await expectPanel(page);
  await page.locator('[data-view="overview"]:visible').first().click();
  await expect(page.locator('#overview')).toBeVisible();
  await expect(page).toHaveURL(/#overview$/);
  await page.goBack();
  await expectPanel(page);
});
