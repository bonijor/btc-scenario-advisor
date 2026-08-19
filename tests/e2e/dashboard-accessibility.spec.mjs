import { test, expect } from '@playwright/test';

async function openDeterministicDashboard(page) {
  await page.goto('/?qa=a11y', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(120);
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = rgb.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('semantic accessibility contract is present', async ({ page }) => {
  await openDeterministicDashboard(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('main#main-content')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('nav[aria-label="Navegación principal"]')).toHaveCount(1);
  await expect(page.locator('nav[aria-label="Navegación móvil"]')).toHaveCount(1);
  await expect(page.locator('.skipLink')).toHaveAttribute('href', '#main-content');
  await expect(page.locator('#priceChart')).toHaveAttribute('role', 'img');
  await expect(page.locator('#priceChart')).toHaveAttribute('aria-describedby', 'chartA11y');
  await expect(page.locator('table caption')).toHaveCount(3);
  await expect(page.locator('.tableWrap[tabindex="0"]')).toHaveCount(3);

  const unnamedButtons = await page.locator('button').evaluateAll((buttons) => buttons.filter((button) => !(button.getAttribute('aria-label') || button.textContent.trim())).length);
  expect(unnamedButtons).toBe(0);

  await expect(page.locator('[data-view="overview"][aria-current="page"]')).toHaveCount(2);
  await expect(page.locator('#overview')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#analytics')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.tfButton.active')).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard skip link and visible navigation preserve focus and state', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('chromium'), 'Keyboard focus gate runs once per Chromium viewport family.');
  await openDeterministicDashboard(page);

  await page.keyboard.press('Tab');
  await expect(page.locator('.skipLink')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  const analyticsButton = page.locator('[data-view="analytics"]:visible').first();
  await expect(analyticsButton).toBeVisible();
  await analyticsButton.focus();
  await expect(analyticsButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(analyticsButton).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#analytics')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#overview')).toHaveAttribute('aria-hidden', 'true');

  const outline = await analyticsButton.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe('none');
});

test('core palette meets WCAG AA contrast budget', async ({ page }) => {
  await openDeterministicDashboard(page);
  const palette = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    return {
      bg: css.getPropertyValue('--bg').trim(),
      panel: css.getPropertyValue('--panel').trim(),
      text: css.getPropertyValue('--text').trim(),
      muted: css.getPropertyValue('--muted').trim(),
      blue: css.getPropertyValue('--blue').trim(),
      green: css.getPropertyValue('--green').trim(),
      amber: css.getPropertyValue('--amber').trim(),
      red: css.getPropertyValue('--red').trim(),
    };
  });

  expect(contrastRatio(palette.text, palette.bg)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(palette.muted, palette.panel)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(palette.blue, palette.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(palette.green, palette.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(palette.amber, palette.bg)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(palette.red, palette.bg)).toBeGreaterThanOrEqual(4.5);
});

test('deterministic QA blocks external network without breaking the shell', async ({ page }) => {
  const external = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') external.push(request.url());
  });
  await openDeterministicDashboard(page);
  await page.waitForTimeout(300);
  expect(external).toEqual([]);
  await expect(page.locator('#engineState')).toContainText('ONLINE');
  await expect(page.locator('#overview')).toBeVisible();
});
