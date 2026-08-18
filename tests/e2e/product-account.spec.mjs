import { test, expect } from '@playwright/test';

async function installAuthAdapter(page) {
  await page.addInitScript(() => {
    window.__BTC_AUTH_TEST_ADAPTER_FACTORY__ = async ({ onState }) => {
      let currentUser = null;
      const emit = () => onState(currentUser, null);
      queueMicrotask(emit);
      return {
        async signInEmail({ email }) {
          currentUser = {
            uid: 'qa-email-user',
            displayName: 'QA Email User',
            email,
            emailVerified: true,
            providerIds: ['password'],
          };
          emit();
          return currentUser;
        },
        async registerEmail({ name, email }) {
          currentUser = {
            uid: 'qa-register-user',
            displayName: name || 'QA Register User',
            email,
            emailVerified: false,
            providerIds: ['password'],
          };
          emit();
          return currentUser;
        },
        async signInGoogle() {
          currentUser = {
            uid: 'qa-google-user',
            displayName: 'QA Google User',
            email: 'qa-google@example.invalid',
            emailVerified: true,
            providerIds: ['google.com'],
          };
          emit();
          return currentUser;
        },
        async signOut() {
          currentUser = null;
          emit();
        },
        getCurrentUser() {
          return currentUser;
        },
      };
    };
  });
}

async function openAccount(page) {
  await installAuthAdapter(page);
  await page.goto('/?qa=a11y', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-view="account"]:visible').first().click();
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#authStatus')).toHaveText('ACTIVO');
}

test('Phase 2B account shell activates managed identity and remains responsive', async ({ page }) => {
  await openAccount(page);

  await expect(page.locator('#productPhase')).toHaveText('FASE 2B');
  await expect(page.locator('#authProvider')).toContainText('Firebase Authentication');
  await expect(page.locator('[data-requires-auth]').first()).toBeEnabled();
  await expect(page.locator('[data-requires-auth]')).toHaveCount(2);
  await expect(page.locator('#authGateMessage')).toContainText('no persiste contraseñas ni tokens');
  await expect(page.locator('#membershipState')).toHaveText('DISEÑO');
  await expect(page.locator('#deliveryState')).toHaveText('BLOQUEADO');
  await expect(page.locator('#authGoogleButton')).toBeEnabled();

  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
});

test('email login clears password and exposes only safe session state', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop-chromium'), 'Credential handling gate runs once in Chromium desktop.');
  await openAccount(page);

  await page.locator('#loginEmail').fill('qa-user@example.invalid');
  await page.locator('#loginPassword').fill('do-not-store-this-password');
  await page.locator('[data-auth-form="login"] button[type="submit"]').click();

  await expect(page.locator('#loginPassword')).toHaveValue('');
  await expect(page.locator('#authSession')).toContainText('QA Email User');
  await expect(page.locator('#authLogoutButton')).toBeVisible();
  await expect(page.locator('#profileState')).toHaveText('AUTENTICADO');

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('do-not-store-this-password');
  expect(storage).not.toContain('qa-user@example.invalid');

  await page.locator('#authLogoutButton').click();
  await expect(page.locator('#authFormStatus')).toContainText('Sesión cerrada');
  await expect(page.locator('#profileState')).toHaveText('SIN SESIÓN');
  await expect(page.locator('[data-auth-form="login"]')).toBeVisible();
});

test('email registration reports verification state without persisting credentials', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop-firefox'), 'Registration flow gate runs once in Firefox desktop.');
  await openAccount(page);

  await page.locator('[data-auth-tab="register"]').click();
  await page.locator('#registerName').fill('QA Registro');
  await page.locator('#registerEmail').fill('qa-register@example.invalid');
  await page.locator('#registerPassword').fill('temporary-password-value');
  await page.locator('[data-auth-form="register"] button[type="submit"]').click();

  await expect(page.locator('#registerPassword')).toHaveValue('');
  await expect(page.locator('#authSession')).toContainText('pendiente de verificación');
  await expect(page.locator('#authFormStatus')).toContainText('email de verificación');

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('temporary-password-value');
  expect(storage).not.toContain('qa-register@example.invalid');
});

test('Google sign-in and logout are wired through the managed adapter', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile-webkit-390'), 'Google adapter gate runs once in mobile WebKit.');
  await openAccount(page);

  await page.locator('#authGoogleButton').click();
  await expect(page.locator('#authSession')).toContainText('QA Google User');
  await expect(page.locator('#authFormStatus')).toContainText('Google');
  await page.locator('#authLogoutButton').click();
  await expect(page.locator('#authGoogleButton')).toBeVisible();
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
  await expect(page.locator('#authStatus')).toHaveText('ACTIVO');
  await expect(page.locator('#pref15m')).not.toBeChecked();
  await expect(page.locator('#prefEmail')).toBeChecked();
  await expect(page.locator('#prefProbability')).toHaveValue('81');
});
