import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

let adminApp: App | null = null;

/**
 * Safely initialize and return the Firebase Admin App instance
 * Uses environment variables securely on the server side
 */
export function getFirebaseAdminApp(): App | null {
  if (adminApp) return adminApp;

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  // 1. Check for complete Service Account JSON string in environment variable
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[FirebaseAdmin] Initialized via FIREBASE_SERVICE_ACCOUNT_KEY');
      return adminApp;
    } catch (e: any) {
      console.error('[FirebaseAdmin] Error parsing service account JSON:', e.message);
    }
  }

  // 2. Check for individual environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKeyRaw) {
    try {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey
        })
      });
      console.log('[FirebaseAdmin] Initialized via individual environment variables');
      return adminApp;
    } catch (e: any) {
      console.error('[FirebaseAdmin] Error initializing with individual variables:', e.message);
    }
  }

  // 3. Fallback attempt for Google Cloud / Vercel default credentials
  try {
    adminApp = initializeApp();
    console.log('[FirebaseAdmin] Initialized via default application credentials');
    return adminApp;
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Firebase Admin credentials not provided in .env yet. FCM Push will be simulated.');
    return null;
  }
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

// Backward compatible default helper
export const getFirebaseAdmin = getFirebaseAdminApp;
export default getFirebaseAdminApp;
