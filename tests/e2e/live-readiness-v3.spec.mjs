import { test, expect } from '@playwright/test';

test('Visual V3 exposes verified readiness without implying live execution', async ({ page }) => {
  await page.goto('/?qa=performance');
  const panel = page.locator('#liveReadinessV3');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-gate="data"] strong')).toHaveText('PASS');
  await expect(panel.locator('[data-gate="economics"] strong')).toHaveText('COLLECTING');
  await expect(panel.locator('[data-gate="formal90d"] strong')).toHaveText('VERIFIED 16/90');
  await expect(panel.locator('[data-gate="risk"] strong')).toHaveText('BLOCKED');
  await expect(panel.locator('[data-gate="execution"] strong')).toHaveText('BLOCKED');
  await expect(page.locator('#readinessOverall')).toHaveText('LIVE_READY = FALSE');
  await expect(page.locator('#readinessMirror')).toHaveText('NO DISPONIBLE');
  await expect(panel).toContainText('12 outcomes');
  await expect(panel).toContainText('0 activados');
  await expect(panel).toContainText('REAL_ORDER_CREATED=false');
  await expect(page.getByText(/comprar ahora|ejecutar orden|enviar a exchange/i)).toHaveCount(0);
});
