import { test, expect } from '@playwright/test';

test('first authenticated use offers guide and simple/technical reading modes', async ({ page }) => {
  await page.goto('/?gate=0&onboarding=1');

  await expect(page.locator('#guideToggle')).toBeVisible();
  await expect(page.locator('#readingModeToggle')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-reading-mode', 'simple');
  await expect(page.locator('#overview .runtimeBanner')).toHaveAttribute('data-reading-detail', 'technical');

  await expect(page.locator('#scenarioGuide')).toBeVisible();
  await expect(page.locator('#scenarioGuideProgress')).toHaveText('1 / 5');
  await expect(page.locator('#scenarioGuideTitle')).toContainText('Resumen');

  await page.locator('#scenarioGuideNext').click();
  await expect(page.locator('#scenarioGuideProgress')).toHaveText('2 / 5');
  await expect(page.locator('#markets')).toHaveClass(/active/);

  await page.locator('#scenarioGuideSkip').click();
  await expect(page.locator('#scenarioGuide')).toBeHidden();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('scenarioOnboardingV1'))).toBe('done');

  await page.locator('#readingModeToggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-reading-mode', 'technical');
  await page.locator('#readingModeToggle').click();
  await expect(page.locator('body')).toHaveAttribute('data-reading-mode', 'simple');

  await page.reload();
  await expect(page.locator('#guideToggle')).toBeVisible();
  await expect(page.locator('#scenarioGuide')).toBeHidden();
});
