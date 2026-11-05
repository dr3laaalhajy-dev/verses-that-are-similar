import * as _admin from 'firebase-admin';
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

export interface FirebaseAdminExtended {
  apps: App[];
  initializeApp: typeof initializeApp;
  credential: {
    cert: typeof cert;
  };
  messaging: (app?: App) => Messaging;
  [key: string]: any;
}

const admin: FirebaseAdminExtended = _admin as any;

// Polyfill admin properties so admin.apps and admin.credential.cert work consistently across SDK versions
if (!admin.credential) {
  admin.credential = { cert };
}
if (!('apps' in admin)) {
  Object.defineProperty(admin, 'apps', {
    get: () => getApps(),
    configurable: true,
  });
}
if (!admin.initializeApp) {
  admin.initializeApp = initializeApp;
}
if (!admin.messaging) {
  admin.messaging = (app?: App) => getMessaging(app || getApps()[0]);
}

/**
 * Explicit Initialization for Firebase Admin on Vercel
 * Prevents "Unable to detect a Project Id" by passing credentials explicitly.
 * Never calls admin.initializeApp() empty.
 */
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1).replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId.trim(),
          clientEmail: clientEmail.trim(),
          // معالجة هامة جداً لرموز السطر الجديد في مفتاح Vercel
          privateKey,
        }),
      });
      console.log('[FirebaseAdmin] Initialized successfully with explicit service account credentials.');
    } catch (err: any) {
      console.error('[FirebaseAdmin] Error during explicit Firebase Admin initialization:', err.message);
    }
  } else {
    // Optional fallback: Complete service account JSON in FIREBASE_SERVICE_ACCOUNT_KEY
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
      try {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('[FirebaseAdmin] Initialized via FIREBASE_SERVICE_ACCOUNT_KEY JSON.');
      } catch (e: any) {
        console.error('[FirebaseAdmin] Error parsing service account JSON:', e.message);
      }
    } else {
      console.warn('[FirebaseAdmin] Firebase service account credentials not found in environment. Explicit initialization skipped to prevent "Unable to detect a Project Id" errors on Vercel.');
    }
  }
}

/**
 * Safely get the active Firebase Admin App instance (or null if not configured)
 */
export function getFirebaseAdminApp(): App | null {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  // If not yet initialized (e.g. env vars loaded late in lambda lifecycle), try explicit init once more
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (privateKey && privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1).replace(/\\n/g, '\n');
  }

  if (projectId && clientEmail && privateKey) {
    try {
      const app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId.trim(),
          clientEmail: clientEmail.trim(),
          privateKey,
        }),
      });
      return app;
    } catch (err: any) {
      console.error('[FirebaseAdmin] Error initializing Firebase Admin on demand:', err.message);
      return null;
    }
  }

  return null;
}

/**
 * Get the Firebase Admin Messaging service for pushing notifications
 */
export function getFirebaseMessaging(): Messaging | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    return getMessaging(app);
  } catch (err) {
    console.error('[FirebaseAdmin] Error getting messaging instance:', err);
    return null;
  }
}

// Backward compatible helpers and exports
export { admin };
export const getFirebaseAdmin = getFirebaseAdminApp;
export default getFirebaseAdminApp;
