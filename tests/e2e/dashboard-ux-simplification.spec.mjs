import { test, expect } from '@playwright/test';

test('dashboard uses one primary experience with progressive detail', async ({ page }) => {
  await page.goto('/?qa=performance');

  await expect(page.locator('a[href*="bi-trading"]')).toHaveCount(0);
  await expect(page.locator('#overview .statusSummaryCard')).toBeVisible();
  await expect(page.locator('#overview .runtimeBanner')).toHaveCount(0);
  await expect(page.locator('#overview .dataPulse')).toHaveCount(0);
  await expect(page.locator('#system .runtimeBanner')).toHaveCount(1);
  await expect(page.locator('#system .dataPulse')).toHaveCount(1);

  const metrics = page.locator('#overview .metricDetails').first();
  await expect(metrics).not.toHaveAttribute('open', '');
  await metrics.locator('summary').click();
  await expect(metrics).toHaveAttribute('open', '');
  await expect(metrics.locator('.modelMetrics')).toBeVisible();

  await page.goto('/landing-v2.html');
  await expect(page.locator('a[href*="bi-trading"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Explorar dashboard/i })).toBeVisible();
});

test('section URLs and browser history preserve navigation state', async ({ page }) => {
  await page.goto('/?qa=performance#trial');
  await expect(page.locator('#trial')).toBeVisible();
  await expect(page.locator('#trial')).toHaveAttribute('aria-hidden', 'false');

  await page.locator('[data-view="analytics"]:visible').first().click();
  await expect(page).toHaveURL(/#analytics$/);
  await expect(page.locator('#analytics')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#trial$/);
  await expect(page.locator('#trial')).toBeVisible();
});

test('mobile navigation keeps five readable destinations and exposes account from Más', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile') && !testInfo.project.name.includes('narrow'), 'Mobile IA gate.');
  await page.goto('/?qa=performance');

  const mobileButtons = page.locator('.mobileNav [data-view]');
  await expect(mobileButtons).toHaveCount(5);
  await expect(page.locator('.mobileNav [data-view="markets"]')).toHaveCount(0);
  await expect(page.locator('.mobileNav [data-view="account"]')).toHaveCount(0);
  const smallestFont = await mobileButtons.evaluateAll((buttons) => Math.min(...buttons.map((button) => Number.parseFloat(getComputedStyle(button).fontSize))));
  expect(smallestFont).toBeGreaterThanOrEqual(9);

  await page.locator('.mobileNav [data-view="system"]').click();
  await expect(page.locator('#system')).toBeVisible();
  await page.locator('#system [data-view="account"]').click();
  await expect(page.locator('#account')).toBeVisible();
  await expect(page).toHaveURL(/#account$/);
});
