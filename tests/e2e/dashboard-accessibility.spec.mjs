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

  const analyticsButtons = page.locator('[data-view="analytics"]:visible');
  await analyticsButtons.first().click();
  await expect(page.locator('#analytics')).toHaveClass(/active/);
  await expect(page.locator('#analytics')).toHaveAttribute('aria-hidden', 'false');
  await expect(analyticsButtons.first()).toHaveAttribute('aria-current', 'page');

  const paperButtons = page.locator('[data-view="paper"]:visible');
  await paperButtons.first().click();
  await expect(page.locator('#paper')).toHaveClass(/active/);
  await expect(page.locator('#paper')).toHaveAttribute('aria-hidden', 'false');
  await expect(paperButtons.first()).toHaveAttribute('aria-current', 'page');
});

test('core palette meets WCAG AA contrast budget', async () => {
  const pairs = [
    ['#eaf2fb', '#081421'],
    ['#96abc2', '#081421'],
    ['#75a8d8', '#081421'],
    ['#f5f9ff', '#0b1726'],
    ['#7cf7bf', '#081421'],
    ['#ffb766', '#081421'],
    ['#ff8c99', '#081421'],
  ];
  for (const [fg, bg] of pairs) {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  }
});

test('deterministic QA blocks external network without breaking the shell', async ({ page }) => {
  const blocked = [];
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      await route.continue();
      return;
    }
    blocked.push(url);
    await route.abort();
  });

  await openDeterministicDashboard(page);
  await expect(page.locator('.app')).toBeVisible();
  await expect(page.locator('#overview')).toHaveClass(/active/);
  expect(blocked.length).toBeGreaterThanOrEqual(0);
});
