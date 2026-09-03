import { test, expect } from '@playwright/test';

async function installProductAdapters(page) {
  await page.addInitScript(() => {
    let currentUser = null;
    const listeners = new Set();
    const profileByUid = new Map();
    const preferenceByUid = new Map();

    window.__BTC_AUTH_TEST_ADAPTER_FACTORY__ = async () => ({
      async init(listener) {
        listeners.add(listener);
        listener(currentUser);
        return () => listeners.delete(listener);
      },
      async loginEmail(email) {
        currentUser = { uid: 'qa-user-1', email, emailVerified: true, displayName: '' };
        listeners.forEach((listener) => listener(currentUser));
        return currentUser;
      },
      async registerEmail(email) {
        currentUser = { uid: 'qa-user-1', email, emailVerified: false, displayName: '' };
        listeners.forEach((listener) => listener(currentUser));
        return currentUser;
      },
      async loginGoogle() {
        currentUser = { uid: 'qa-google-1', email: 'qa-google@example.invalid', emailVerified: true, displayName: 'QA Google' };
        listeners.forEach((listener) => listener(currentUser));
        return currentUser;
      },
      async logout() {
        currentUser = null;
        listeners.forEach((listener) => listener(currentUser));
      },
      async updateDisplayName(displayName) {
        if (currentUser) currentUser = { ...currentUser, displayName };
        listeners.forEach((listener) => listener(currentUser));
        return currentUser;
      },
      getCurrentUser() {
        return currentUser;
      },
    });

    window.__BTC_PROFILE_TEST_ADAPTER_FACTORY__ = async () => ({
      async load(uid) {
        return {
          profile: profileByUid.get(uid) || { displayName: '' },
          preferences: preferenceByUid.get(uid) || null,
          entitlement: { plan: 'free' },
        };
      },
      async saveProfile(uid, profile) {
        profileByUid.set(uid, { ...(profileByUid.get(uid) || {}), ...profile });
        return profileByUid.get(uid);
      },
      async savePreferences(uid, preferences) {
        preferenceByUid.set(uid, { ...preferences });
        return preferenceByUid.get(uid);
      },
      async loadEntitlement() {
        return { plan: 'free' };
      },
    });
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

  const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(testInfo.project.use.viewport.width + 1);
});

test('email login clears password and opens a cloud-backed private workspace', async ({ page }) => {
  await openAccount(page);
  await page.locator('#loginPassword').fill('do-not-store-this-password');
  await page.locator('#loginEmail').fill('qa-user@example.invalid');
  await page.locator('[data-auth-form="login"] button[type="submit"]').click();

  await expect(page.locator('#loginPassword')).toHaveValue('');
  await expect(page.locator('#account')).toHaveClass(/is-authenticated/);
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
  await expect(page.locator('.preferencesCard')).toBeVisible();
});

test('cloud profile name persists and updates authenticated identity', async ({ page }) => {
  await openAccount(page);
  await loginEmail(page);

  await page.locator('#profileDisplayName').fill('QA Persisted');
  await page.locator('#cloudProfileForm button[type="submit"]').click();
  await expect(page.locator('#cloudProfileStatus')).toHaveText('Sincronizado');
  await expect(page.locator('.accountIdentity')).toContainText('QA Persisted');
});

test('email registration reports verification state without persisting credentials', async ({ page }) => {
  test.skip(!test.info().project.name.includes('chromium'), 'registration path covered once per Chromium profile');
  await openAccount(page);
  await page.locator('[data-auth-tab="register"]').click();
  await page.locator('#registerEmail').fill('qa-register@example.invalid');
  await page.locator('#registerPassword').fill('temporary-password');
  await page.locator('[data-auth-form="register"] button[type="submit"]').click();

  await expect(page.locator('#registerPassword')).toHaveValue('');
  await expect(page.locator('#authFormStatus')).toContainText(/verific/i);
});

test('Google sign-in opens the private workspace and logout closes it', async ({ page }) => {
  test.skip(!test.info().project.name.includes('webkit'), 'Google shell path covered on WebKit profiles');
  await openAccount(page);
  await page.locator('#authGoogleButton').click();
  await expect(page.locator('#account')).toHaveClass(/is-authenticated/);
  await expect(page.locator('#authLogoutButton')).toBeVisible();
  await page.locator('#authLogoutButton').click();
  await expect(page.locator('#account')).toHaveClass(/is-anonymous/);
});

test('preferences synchronize to cloud and survive a new authenticated session', async ({ page }) => {
  test.skip(!test.info().project.name.includes('chromium'), 'cloud preference persistence covered on Chromium profiles');
  await openAccount(page);
  await loginEmail(page);
  await page.locator('#prefProbability').fill('81');
  await page.locator('#preferencesForm button[type="submit"]').click();
  await expect(page.locator('#cloudSyncBadge')).toHaveText('EN NUBE');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await navigateToAccount(page);
  await expect(page.locator('#prefProbability')).toHaveValue('81');
});
