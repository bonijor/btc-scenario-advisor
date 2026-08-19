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

async function buildAdapter({ onState }) {
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
    (user) => onState?.(safeUser(user), null),
    (error) => onState?.(null, error),
  );

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
      return safeUser(auth.currentUser);
    },

    async signInGoogle() {
      const credential = await authSdk.signInWithPopup(auth, googleProvider);
      return safeUser(credential.user);
    },

    async updateDisplayName(displayName) {
      if (!auth.currentUser) {
        const error = new Error('No hay una sesión activa.');
        error.code = 'auth/no-current-user';
        throw error;
      }
      await authSdk.updateProfile(auth.currentUser, { displayName: cleanName(displayName) });
      await auth.currentUser.reload();
      onState?.(safeUser(auth.currentUser), null);
      return safeUser(auth.currentUser);
    },

    async getIdToken(forceRefresh = false) {
      if (!auth.currentUser) {
        const error = new Error('No hay una sesión activa.');
        error.code = 'auth/no-current-user';
        throw error;
      }
      return auth.currentUser.getIdToken(forceRefresh === true);
    },

    async signOut() {
      await authSdk.signOut(auth);
    },

    getCurrentUser() {
      return safeUser(auth.currentUser);
    },

    destroy() {
      unsubscribe();
    },
  });
}

export function createFirebaseAuthAdapter(options = {}) {
  if (!adapterPromise) adapterPromise = buildAdapter(options).catch((error) => {
    adapterPromise = null;
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
