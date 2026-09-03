import { test, expect } from '@playwright/test';

async function installProductAdapters(page) {
  await page.addInitScript(() => {
    const CLOUD_KEY = '__btc_qa_cloud_store_v1';
    const readCloud = () => {
      try { return JSON.parse(localStorage.getItem(CLOUD_KEY) || '{}'); } catch { return {}; }
    };
    const writeCloud = (value) => localStorage.setItem(CLOUD_KEY, JSON.stringify(value));

    window.__BTC_PROFILE_TEST_ADAPTER_FACTORY__ = async () => ({
      async ensureProfile({ uid, displayName }) {
        const store = readCloud();
        store[uid] ||= {};
        store[uid].profile ||= { displayName: displayName || '', schemaVersion: 1 };
        writeCloud(store);
        return store[uid].profile;
      },
      async loadWorkspace(uid) {
        const store = readCloud();
        const user = store[uid] || {};
        return {
          profile: user.profile || null,
          preferences: user.preferences || null,
          entitlement: user.entitlement || null,
        };
      },
      async saveProfile({ uid, displayName }) {
        const store = readCloud();
        store[uid] ||= {};
        store[uid].profile = { displayName, schemaVersion: 1 };
        writeCloud(store);
        return store[uid].profile;
      },
      async savePreferences(uid, preferences) {
        const store = readCloud();
        store[uid] ||= {};
        store[uid].preferences = { ...preferences };
        writeCloud(store);
        return store[uid].preferences;
      },
    });

    window.__BTC_AUTH_TEST_ADAPTER_FACTORY__ = async ({ onState }) => {
      let currentUser = null;
      const emit = () => onState(currentUser, null);
      queueMicrotask(emit);
      return {
        async signInEmail({ email }) {
          currentUser = {
            uid: `qa-${email.split('@')[0]}`,
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
        async updateDisplayName(displayName) {
          if (currentUser) currentUser = { ...currentUser, displayName };
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
  await installProductAdapters(page);
  await page.goto('/?qa=a11y', { waitUntil: 'domcontentloaded' });
  await navigateToAccount(page);
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#authStatus')).toHaveText('ACTIVO');
}

async function navigateToAccount(page) {
  const account = page.locator('[data-view="account"]:visible');
  if (await account.count()) {
    await account.first().click();
    return;
  }
  const system = page.locator('[data-view="system"]:visible');
  await expect(system.first()).toBeVisible();
  await system.first().click();
  await page.locator('#system [data-view="account"]').click();
}

async function loginEmail(page, email = 'qa-user@example.invalid') {
  await page.locator('#loginEmail').fill(email);
  await page.locator('#loginPassword').fill('do-not-store-this-password');
  await page.locator('[data-auth-form="login"] button[type="submit"]').click();
  await expect(page.locator('#account')).toHaveClass(/is-authenticated/);
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
}

test('Phase 2D account shell keeps anonymous access focused and responsive', async ({ page }, testInfo) => {
  await openAccount(page);

  await expect(page.locator('#productPhase')).toHaveText('FASE 2D');
  await expect(page.locator('#authProvider')).toContainText('Firebase Authentication');
  await expect(page.locator('#account')).toHaveClass(/is-anonymous/);
  await expect(page.locator('[data-auth-form="login"]')).toBeVisible();
  await expect(page.locator('[data-auth-form="register"]')).toBeHidden();
  await expect(page.locator('#authGoogleButton')).toBeVisible();
  await expect(page.locator('#authGoogleButton')).toBeEnabled();
  await expect(page.locator('#authLogoutButton')).toBeHidden();
  await expect(page.locator('.preferencesCard')).toBeHidden();
  await expect(page.locator('#account > .lowerGrid')).toBeHidden();
  await expect(page.locator('.passwordToggle')).toHaveCount(2);
  await expect(page.locator('[data-requires-auth]')).toHaveCount(2);
  await expect(page.locator('#authGateMessage')).toContainText('Acceso seguro');
  await expect(page.locator('#membershipState')).toHaveText('DISEÑO');
  await expect(page.locator('#deliveryState')).toHaveText('BLOQUEADO');

  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
  await page.screenshot({ path: testInfo.outputPath('account-anonymous-phase2d.png'), fullPage: true });
});

test('email login clears password and opens a cloud-backed private workspace', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop-chromium'), 'Credential handling and cloud workspace gate runs once in Chromium desktop.');
  await openAccount(page);
  await loginEmail(page);

  await expect(page.locator('#loginPassword')).toHaveValue('');
  await expect(page.locator('#authSession')).toContainText('QA Email User');
  await expect(page.locator('#authLogoutButton')).toBeVisible();
  await expect(page.locator('#profileState')).toHaveText('EN NUBE');
  await expect(page.locator('#profileStorageState')).toHaveText('CLOUD FIRESTORE');
  await expect(page.locator('#profilePlanState')).toHaveText('FREE');
  await expect(page.locator('.preferencesCard')).toBeVisible();
  await expect(page.locator('#account > .lowerGrid')).toBeVisible();
  await expect(page.locator('[data-auth-form="login"]')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('account-cloud-authenticated-email.png'), fullPage: true });

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('do-not-store-this-password');
  expect(storage).not.toContain('qa-user@example.invalid');

  await page.locator('#authLogoutButton').click();
  await expect(page.locator('#authFormStatus')).toContainText('Sesión cerrada');
  await expect(page.locator('#profileState')).toHaveText('SIN SESIÓN');
  await expect(page.locator('#account')).toHaveClass(/is-anonymous/);
  await expect(page.locator('[data-auth-form="login"]')).toBeVisible();
  await expect(page.locator('.preferencesCard')).toBeHidden();
});

test('cloud profile name persists and updates authenticated identity', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('desktop-chromium'), 'Cloud profile write gate runs once in Chromium desktop.');
  await openAccount(page);
  await loginEmail(page, 'qa-profile@example.invalid');

  await page.locator('#profileDisplayName').fill('Jor QA');
  await page.locator('#cloudProfileForm button[type="submit"]').click();
  await expect(page.locator('#cloudProfileStatus')).toHaveText('Sincronizado');
  await expect(page.locator('#authSession')).toContainText('Jor QA');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await navigateToAccount(page);
  await expect(page.locator('#authStatus')).toHaveText('ACTIVO');
  await loginEmail(page, 'qa-profile@example.invalid');
  await expect(page.locator('#profileDisplayName')).toHaveValue('Jor QA');
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
});

test('email registration reports verification state without persisting credentials', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('firefox'), 'Registration flow gate runs once in Firefox.');
  await openAccount(page);

  await page.locator('[data-auth-tab="register"]').click();
  await expect(page.locator('[data-auth-form="login"]')).toBeHidden();
  await expect(page.locator('[data-auth-form="register"]')).toBeVisible();
  await page.locator('#registerName').fill('QA Registro');
  await page.locator('#registerEmail').fill('qa-register@example.invalid');
  await page.locator('#registerPassword').fill('temporary-password-value');
  await page.locator('[data-auth-form="register"] button[type="submit"]').click();

  await expect(page.locator('#registerPassword')).toHaveValue('');
  await expect(page.locator('#authSession')).toContainText('pendiente de verificación');
  await expect(page.locator('#authFormStatus')).toContainText('email de verificación');
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
  await expect(page.locator('.preferencesCard')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('account-registered-email-phase2d.png'), fullPage: true });

  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain('temporary-password-value');
  expect(storage).not.toContain('qa-register@example.invalid');
});

test('Google sign-in opens the private workspace and logout closes it', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile-webkit-390'), 'Google adapter gate runs once in mobile WebKit.');
  await openAccount(page);

  await page.locator('#authGoogleButton').click();
  await expect(page.locator('#authSession')).toContainText('QA Google User');
  await expect(page.locator('#authFormStatus')).toContainText('Google');
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
  await expect(page.locator('.preferencesCard')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('account-authenticated-google-phase2d.png'), fullPage: true });
  await page.locator('#authLogoutButton').click();
  await expect(page.locator('#authGoogleButton')).toBeVisible();
  await expect(page.locator('.preferencesCard')).toBeHidden();
});

test('preferences synchronize to cloud and survive a new authenticated session', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile-chromium-390'), 'Cloud preference persistence gate runs once in Chromium mobile.');
  await openAccount(page);
  await loginEmail(page, 'qa-preferences@example.invalid');

  await page.locator('#pref15m').uncheck();
  await page.locator('#prefEmail').check();
  await page.locator('#prefProbability').fill('81');
  await page.locator('#preferencesForm button[type="submit"]').click();
  await expect(page.locator('#preferencesStatus')).toContainText('sincronizadas en nube');
  await expect(page.locator('#probabilityHelp')).toContainText('No cambia');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await navigateToAccount(page);
  await expect(page.locator('#authStatus')).toHaveText('ACTIVO');
  await loginEmail(page, 'qa-preferences@example.invalid');
  await expect(page.locator('#pref15m')).not.toBeChecked();
  await expect(page.locator('#prefEmail')).toBeChecked();
  await expect(page.locator('#prefProbability')).toHaveValue('81');
  await expect(page.locator('#profileStorageState')).toHaveText('CLOUD FIRESTORE');
});