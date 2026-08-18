const FIREBASE_SDK_VERSION = '12.16.0';
const SDK_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

let adapterPromise = null;

const DEFAULT_PREFERENCES = Object.freeze({
  horizon5m: true,
  horizon15m: true,
  web: true,
  email: false,
  whatsapp: false,
  minProbability: 72,
  quietHours: false,
});

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function cleanPreferences(value = {}) {
  return Object.freeze({
    horizon5m: value.horizon5m !== false,
    horizon15m: value.horizon15m !== false,
    web: value.web !== false,
    email: value.email === true,
    whatsapp: value.whatsapp === true,
    minProbability: Math.max(50, Math.min(99, Math.round(Number(value.minProbability) || 72))),
    quietHours: value.quietHours === true,
  });
}

function safeEntitlement(value) {
  if (!value || typeof value !== 'object') return null;
  const plan = ['free', 'pro', 'premium'].includes(String(value.plan || '').toLowerCase())
    ? String(value.plan).toLowerCase()
    : 'free';
  return Object.freeze({
    plan,
    status: String(value.status || 'inactive').slice(0, 32),
  });
}

async function buildAdapter() {
  const [appSdk, firestoreSdk] = await Promise.all([
    import(`${SDK_BASE}/firebase-app.js`),
    import(`${SDK_BASE}/firebase-firestore.js`),
  ]);

  if (!appSdk.getApps().length) {
    const error = new Error('Firebase debe inicializarse desde el adaptador de identidad antes de abrir el perfil.');
    error.code = 'profile/auth-not-ready';
    throw error;
  }

  const app = appSdk.getApp();
  const db = firestoreSdk.getFirestore(app);

  const profileRef = (uid) => firestoreSdk.doc(db, 'users', uid);
  const preferencesRef = (uid) => firestoreSdk.doc(db, 'users', uid, 'settings', 'preferences');
  const entitlementRef = (uid) => firestoreSdk.doc(db, 'entitlements', uid);

  async function loadProfile(uid) {
    const snapshot = await firestoreSdk.getDoc(profileRef(uid));
    if (!snapshot.exists()) return null;
    const data = snapshot.data() || {};
    return Object.freeze({
      displayName: cleanName(data.displayName),
      schemaVersion: Number(data.schemaVersion) || 1,
    });
  }

  async function ensureProfile({ uid, displayName }) {
    const ref = profileRef(uid);
    const snapshot = await firestoreSdk.getDoc(ref);
    if (snapshot.exists()) return loadProfile(uid);

    const now = firestoreSdk.serverTimestamp();
    await firestoreSdk.setDoc(ref, {
      displayName: cleanName(displayName),
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    });
    return Object.freeze({ displayName: cleanName(displayName), schemaVersion: 1 });
  }

  async function saveProfile({ uid, displayName }) {
    const ref = profileRef(uid);
    const snapshot = await firestoreSdk.getDoc(ref);
    const cleaned = cleanName(displayName);
    if (!snapshot.exists()) {
      const now = firestoreSdk.serverTimestamp();
      await firestoreSdk.setDoc(ref, {
        displayName: cleaned,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await firestoreSdk.updateDoc(ref, {
        displayName: cleaned,
        schemaVersion: 1,
        updatedAt: firestoreSdk.serverTimestamp(),
      });
    }
    return Object.freeze({ displayName: cleaned, schemaVersion: 1 });
  }

  async function loadPreferences(uid) {
    const snapshot = await firestoreSdk.getDoc(preferencesRef(uid));
    if (!snapshot.exists()) return null;
    return cleanPreferences(snapshot.data());
  }

  async function savePreferences(uid, preferences) {
    const cleaned = cleanPreferences(preferences);
    await firestoreSdk.setDoc(preferencesRef(uid), {
      ...cleaned,
      schemaVersion: 1,
      updatedAt: firestoreSdk.serverTimestamp(),
    });
    return cleaned;
  }

  async function loadEntitlement(uid) {
    const snapshot = await firestoreSdk.getDoc(entitlementRef(uid));
    return snapshot.exists() ? safeEntitlement(snapshot.data()) : null;
  }

  async function loadWorkspace(uid) {
    const [profile, preferences, entitlement] = await Promise.all([
      loadProfile(uid),
      loadPreferences(uid),
      loadEntitlement(uid),
    ]);
    return Object.freeze({ profile, preferences, entitlement });
  }

  return Object.freeze({
    ensureProfile,
    loadWorkspace,
    saveProfile,
    savePreferences,
    defaults: DEFAULT_PREFERENCES,
  });
}

export function createFirebaseProfileAdapter() {
  if (!adapterPromise) adapterPromise = buildAdapter().catch((error) => {
    adapterPromise = null;
    throw error;
  });
  return adapterPromise;
}

export const cloudProfileContract = Object.freeze({
  schemaVersion: 1,
  profilePath: 'users/{uid}',
  preferencesPath: 'users/{uid}/settings/preferences',
  entitlementPath: 'entitlements/{uid}',
  entitlementClientWrite: false,
  sdkVersion: FIREBASE_SDK_VERSION,
});
