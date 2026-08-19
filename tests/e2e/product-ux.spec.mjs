import { test, expect } from '@playwright/test';

test('guided product UX adds clear navigation, theme preference and scoped markets', async ({ page }) => {
  await page.goto('/?qa=performance');

  await expect(page.locator('.brand strong')).toHaveText('Scenario Advisor');
  await expect(page.locator('.brand small')).toContainText('Crypto Shadow Lab');
  await expect(page.locator('link[data-scenario-favicon]')).toHaveAttribute('href', 'assets/scenario-mark.svg');

  const trialNav = page.locator('.nav [data-view="trial"]');
  await expect(trialNav).toContainText('Prueba 90D');
  await expect(trialNav.locator('.navDesc')).toContainText('evidencia verificable');

  await expect(page.locator('#trial > .moduleIntro')).toContainText('no significa que ese día haya sido rentable');

  const theme = page.locator('#themeToggle');
  await expect(theme).toBeVisible();
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const marketsNav = page.locator('.nav [data-view="markets"]');
  await expect(marketsNav).toContainText('Mercados');
  await marketsNav.click();
  await expect(page.locator('#markets')).toHaveClass(/active/);
  await expect(page.locator('[data-market-card]')).toHaveCount(3);
  await expect(page.locator('[data-market-card="BTCUSDT"] [data-market-price]')).not.toHaveText('Cargando…');
  await expect(page.locator('#markets .marketScopeNote')).toContainText('siguen formalmente calibrados para BTC/USDT');
});
