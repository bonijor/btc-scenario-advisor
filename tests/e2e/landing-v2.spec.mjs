import { test, expect } from '@playwright/test';

test.describe('Landing v2 Web Intelligence lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/landing-v2.html');
  });

  test('preserves the safety narrative and product hierarchy', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Decisiones explicables');
    await expect(page.getByText('SHADOW', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('SPOT ONLY', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('NO EXECUTION', { exact: true })).toBeVisible();
    await expect(page.getByText('11', { exact: true })).toBeVisible();
    await expect(page.getByText('/ 90', { exact: true })).toBeVisible();
    await expect(page.getByText(/Snapshot verificado el 29\/08\/2026/)).toBeVisible();
    await expect(page.getByText(/no financial advice/i)).toBeVisible();
  });

  test('keeps the lab separate from the existing dashboard', async ({ page }) => {
    const dashboardLinks = page.getByRole('link', { name: /dashboard|BTC Scenario Advisor/i });
    await expect(dashboardLinks.first()).toHaveAttribute('href', /index\.html/);
    await expect(page.getByRole('link', { name: 'Abrir BI Trading' })).toHaveAttribute('href', 'bi-trading.html');
  });

  test('uses semantic landmarks and keyboard-reachable skip navigation', async ({ page }) => {
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main#contenido')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    await page.keyboard.press('Tab');
    const skip = page.locator('.skip-link');
    await expect(skip).toBeFocused();
    await expect(skip).toHaveAttribute('href', '#contenido');
  });

  test('does not introduce execution controls', async ({ page }) => {
    const forbiddenLabels = [
      /comprar/i,
      /vender/i,
      /buy now/i,
      /sell now/i,
      /place order/i,
      /execute trade/i,
    ];

    for (const label of forbiddenLabels) {
      await expect(page.getByRole('button', { name: label })).toHaveCount(0);
      await expect(page.getByRole('link', { name: label })).toHaveCount(0);
    }
  });

  test('fits narrow mobile without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  });
});
