import './quant-decision-bridge.js';

const FIREBASE_SDK_VERSION = '12.16.0';

const FIREBASE_CONFIG = Object.freeze({
  apiKey: 'AIzaSyD1OOFMUHiaYnhr1k19LAgkJlqehKteMjc',
  authDomain: 'linear-poet-426418-k0.firebaseapp.com',
  projectId: 'linear-poet-426418-k0',
  storageBucket: 'linear-poet-426418-k0.firebasestorage.app',
  messagingSenderId: '531376347818',
  appId: '1:531376347818:web:fc733e0485165b4c158ed3',
});

const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
let adapterPromise = null;
let productUiBound = false;
let productUiPromise = null;
let authStateInitialized = false;
let lastAuthUser = null;
let lastAuthError = null;
const stateListeners = new Set();

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function safeUser(user) {
  if (!user) return null;
  return Object.freeze({
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    emailVerified: user.emailVerified === true,
    photoURL: user.photoURL || '',
    providerIds: (user.providerData || []).map((entry) => entry?.providerId).filter(Boolean),
  });
}

function emitAuthState(user, error = null) {
  authStateInitialized = true;
  lastAuthUser = user || null;
  lastAuthError = error || null;
  for (const listener of [...stateListeners]) {
    try { listener(lastAuthUser, lastAuthError); } catch { /* listeners are isolated */ }
  }
}

function addStateListener(listener) {
  if (typeof listener !== 'function') return () => {};
  stateListeners.add(listener);
  if (authStateInitialized) queueMicrotask(() => listener(lastAuthUser, lastAuthError));
  return () => stateListeners.delete(listener);
}

function bindProductControlUiLoader() {
  if (productUiBound) return;
  productUiBound = true;
  const load = () => {
    if (!productUiPromise) productUiPromise = import('./product-control-ui.js').catch((error) => {
      productUiPromise = null;
      throw error;
    });
    return productUiPromise;
  };
  document.querySelectorAll('[data-view="account"]').forEach((button) => {
    button.addEventListener('click', () => { load().catch(() => {}); }, { passive: true });
  });
  if (new URLSearchParams(location.search).get('membership') === 'return') load().catch(() => {});
}

async function buildAdapter() {
  const [appSdk, authSdk] = await Promise.all([
    import(`${SDK_BASE}/firebase-app.js`),
    import(`${SDK_BASE}/firebase-auth.js`),
  ]);

  const app = appSdk.getApps().length ? appSdk.getApp() : appSdk.initializeApp(FIREBASE_CONFIG);
  const auth = authSdk.getAuth(app);
  auth.useDeviceLanguage();
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);

  const googleProvider = new authSdk.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  const unsubscribe = authSdk.onAuthStateChanged(
    auth,
    (user) => emitAuthState(safeUser(user), null),
    (error) => emitAuthState(null, error),
  );

  function requireCurrentUser() {
    if (auth.currentUser) return auth.currentUser;
    const error = new Error('No hay una sesión activa.');
    error.code = 'auth/no-current-user';
    throw error;
  }

  return Object.freeze({
    async signInEmail({ email, password }) {
      const credential = await authSdk.signInWithEmailAndPassword(auth, email, password);
      return safeUser(credential.user);
    },

    async registerEmail({ name, email, password }) {
      const credential = await authSdk.createUserWithEmailAndPassword(auth, email, password);
      const cleanDisplayName = cleanName(name);
      if (cleanDisplayName) await authSdk.updateProfile(credential.user, { displayName: cleanDisplayName });
      await credential.user.reload();
      await authSdk.sendEmailVerification(credential.user);
      const user = safeUser(auth.currentUser);
      emitAuthState(user, null);
      return user;
    },

    async signInGoogle() {
      const credential = await authSdk.signInWithPopup(auth, googleProvider);
      return safeUser(credential.user);
    },

    async resetPassword(email) {
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail) {
        const error = new Error('Email requerido.');
        error.code = 'auth/invalid-email';
        throw error;
      }
      await authSdk.sendPasswordResetEmail(auth, cleanEmail);
      return true;
    },

    async sendVerification() {
      const user = requireCurrentUser();
      await user.reload();
      if (!user.emailVerified) await authSdk.sendEmailVerification(user);
      const snapshot = safeUser(auth.currentUser);
      emitAuthState(snapshot, null);
      return snapshot;
    },

    async refreshCurrentUser() {
      const user = requireCurrentUser();
      await user.reload();
      const snapshot = safeUser(auth.currentUser);
      emitAuthState(snapshot, null);
      return snapshot;
    },

    async updateDisplayName(displayName) {
      const user = requireCurrentUser();
      await authSdk.updateProfile(user, { displayName: cleanName(displayName) });
      await user.reload();
      const snapshot = safeUser(auth.currentUser);
      emitAuthState(snapshot, null);
      return snapshot;
    },

    async getIdToken(forceRefresh = false) {
      const user = requireCurrentUser();
      return user.getIdToken(forceRefresh === true);
    },

    async signOut() {
      await authSdk.signOut(auth);
    },

    getCurrentUser() {
      return safeUser(auth.currentUser);
    },

    subscribe(listener) {
      return addStateListener(listener);
    },

    destroy() {
      unsubscribe();
    },
  });
}

export function createFirebaseAuthAdapter(options = {}) {
  bindProductControlUiLoader();
  addStateListener(options.onState);
  if (!adapterPromise) adapterPromise = buildAdapter().catch((error) => {
    adapterPromise = null;
    emitAuthState(null, error);
    throw error;
  });
  return adapterPromise;
}

export const firebasePublicConfig = Object.freeze({
  projectId: FIREBASE_CONFIG.projectId,
  authDomain: FIREBASE_CONFIG.authDomain,
  appId: FIREBASE_CONFIG.appId,
  sdkVersion: FIREBASE_SDK_VERSION,
});
