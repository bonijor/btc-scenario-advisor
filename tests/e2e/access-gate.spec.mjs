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

async function openGate(page, query = '?gate=1') {
  await installGateAdapter(page);
  await page.goto(`/${query}`, { waitUntil: 'domcontentloaded' });
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

test('verified session attaches dedicated Firebase bearer only to dashboard Cloud Run request', async ({ page }) => {
  const observed = [];
  await page.route('https://btc-shadow-dashboard-api.example.run.app/**', async (route) => {
    const headers = route.request().headers();
    observed.push({
      url: route.request().url(),
      authorization: headers.authorization || null,
      dashboardAuthorization: headers['x-btc-dashboard-authorization'] || null,
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.route('https://api.binance.com/**', async (route) => {
    const headers = route.request().headers();
    observed.push({
      url: route.request().url(),
      authorization: headers.authorization || null,
      dashboardAuthorization: headers['x-btc-dashboard-authorization'] || null,
    });
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await openGate(page, '?gate=1&dashboardAuth=1');
  await page.locator('#gateLoginEmail').fill('gate@example.invalid');
  await page.locator('#gateLoginPassword').fill('qa-password');
  await page.locator('#gateLoginForm button[type="submit"]').click();
  await expect(page.locator('body')).toHaveClass(/auth-granted/);

  await page.evaluate(async () => {
    await fetch('https://btc-shadow-dashboard-api.example.run.app/api/v1/dashboard');
    await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
  });

  const dashboard = observed.find((x) => x.url.includes('/api/v1/dashboard'));
  const binance = observed.find((x) => x.url.includes('api.binance.com'));
  expect(dashboard?.dashboardAuthorization).toBe('Bearer qa-token');
  expect(dashboard?.authorization).toBeNull();
  expect(binance?.dashboardAuthorization).toBeNull();
  expect(binance?.authorization).toBeNull();
});
