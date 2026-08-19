import { test, expect } from '@playwright/test';

async function installGateAdapter(page) {
  await page.addInitScript(() => {
    window.__BTC_AUTH_TEST_ADAPTER_FACTORY__ = async ({ onState }) => {
      let currentUser = null;
      const emit = () => onState(currentUser, null);
      queueMicrotask(emit);
      return {
        async signInEmail({ email }) {
          currentUser = { uid: 'gate-email', displayName: 'Gate QA', email, emailVerified: true, providerIds: ['password'] };
          emit();
          return currentUser;
        },
        async registerEmail({ name, email }) {
          currentUser = { uid: 'gate-register', displayName: name, email, emailVerified: false, providerIds: ['password'] };
          emit();
          return currentUser;
        },
        async signInGoogle() {
          currentUser = { uid: 'gate-google', displayName: 'Gate Google', email: 'gate-google@example.invalid', emailVerified: true, providerIds: ['google.com'] };
          emit();
          return currentUser;
        },
        async resetPassword() { return true; },
        async sendVerification() { return currentUser; },
        async refreshCurrentUser() {
          if (currentUser) currentUser = { ...currentUser, emailVerified: true };
          emit();
          return currentUser;
        },
        async updateDisplayName(displayName) { if (currentUser) currentUser = { ...currentUser, displayName }; emit(); return currentUser; },
        async getIdToken() { return 'qa-token'; },
        async signOut() { currentUser = null; emit(); },
        getCurrentUser() { return currentUser; },
      };
    };
  });
}

async function openGate(page) {
  await installGateAdapter(page);
  await page.goto('/?gate=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#authGate')).toBeVisible();
}

test('Shadow Lab gate blocks dashboard until a verified Firebase session exists', async ({ page }) => {
  await openGate(page);
  await expect(page.locator('#gateLoginForm')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('inert', '');
  await expect(page.locator('body')).not.toHaveClass(/auth-granted/);

  await page.locator('#gateLoginEmail').fill('gate@example.invalid');
  await page.locator('#gateLoginPassword').fill('qa-password');
  await page.locator('#gateLoginForm button[type="submit"]').click();

  await expect(page.locator('#authGate')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/auth-granted/);
  await expect(page.locator('.app')).not.toHaveAttribute('inert', '');
});

test('new email accounts remain blocked until email verification is confirmed', async ({ page }) => {
  await openGate(page);
  await page.getByRole('button', { name: 'Crear una cuenta' }).click();
  await page.locator('#gateRegisterName').fill('Usuario QA');
  await page.locator('#gateRegisterEmail').fill('new-gate@example.invalid');
  await page.locator('#gateRegisterPassword').fill('qa-password');
  await page.locator('#gateRegisterForm button[type="submit"]').click();

  await expect(page.locator('[data-gate-panel="verify"]')).toBeVisible();
  await expect(page.locator('.app')).toHaveAttribute('inert', '');
  await page.locator('#gateCheckVerification').click();
  await expect(page.locator('#authGate')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/auth-granted/);
});
