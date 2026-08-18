import { test, expect } from '@playwright/test';

async function openAccount(page) {
  await page.goto('/?qa=a11y', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="account"]:visible').first().click();
  await expect(page.locator('#account')).toBeVisible();
}

test('Phase 2A account shell is responsive and fail-closed', async ({ page }) => {
  await openAccount(page);

  await expect(page.locator('#authStatus')).toHaveText('PENDIENTE');
  await expect(page.locator('#authProvider')).toContainText('Firebase Authentication');
  await expect(page.locator('[data-requires-auth]')).toBeDisabled();
  await expect(page.locator('#authGateMessage')).toContainText('no simular cuentas');
  await expect(page.locator('#membershipState')).toHaveText('DISEÑO');
  await expect(page.locator('#deliveryState')).toHaveText('BLOQUEADO');

  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
});

test('credential fields are never persisted by the Phase 2A shell', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop-chromium'), 'Credential persistence gate runs once in Chromium desktop.');
  await openAccount(page);

  await page.locator('#loginEmail').fill('qa-user@example.invalid');
  await page.locator('#loginPassword').fill('do-not-store-this-password');
  await page.locator('[data-auth-form="login"]').evaluate((form) => form.requestSubmit());

  await expect(page.locator('#loginPassword')).toHaveValue('');
  await expect(page.locator('#authFormStatus')).toContainText('No se guardó ninguna contraseña');

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('do-not-store-this-password');
  expect(storage).not.toContain('qa-user@example.invalid');
});

test('non-sensitive preview preferences persist without changing model settings', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile-chromium-390'), 'Preference persistence gate runs once in Chromium mobile.');
  await openAccount(page);

  await page.locator('#pref15m').uncheck();
  await page.locator('#prefEmail').check();
  await page.locator('#prefProbability').fill('81');
  await page.locator('#preferencesForm button[type="submit"]').click();
  await expect(page.locator('#preferencesStatus')).toContainText('sólo en este navegador');
  await expect(page.locator('#probabilityHelp')).toContainText('No cambia');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="account"]:visible').first().click();
  await expect(page.locator('#pref15m')).not.toBeChecked();
  await expect(page.locator('#prefEmail')).toBeChecked();
  await expect(page.locator('#prefProbability')).toHaveValue('81');
});
