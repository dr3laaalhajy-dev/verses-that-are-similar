import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

// Firebase Client Configuration - reads from Vite env variables with fallback structure
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyPlaceholder_Config_Only',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'matin-quran'}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'matin-quran',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'matin-quran'}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '100000000000',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:100000000000:web:abcdef1234567890',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
};

// VAPID Key (Public Key for Web Push Certificates)
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

// Initialize Firebase App instance
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let messagingInstance: Messaging | null = null;

/**
 * Safely initialize FCM Messaging instance
 */
export async function getFCMMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Firebase Messaging is not supported on this browser/environment.');
      return null;
    }

    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (err) {
    console.warn('[FCM] Error initializing messaging:', err);
    return null;
  }
}

/**
 * Register Service Worker and retrieve FCM Device Token
 */
export async function requestFCMToken(customVapidKey?: string): Promise<string | null> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[FCM] Notifications or Service Worker not supported.');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied by user.');
      return null;
    }

    const messaging = await getFCMMessaging();
    if (!messaging) return null;

    // Register firebase-messaging-sw.js service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });

    const activeVapidKey = customVapidKey || VAPID_KEY;
    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey: activeVapidKey
    });

    if (token) {
      console.log('[FCM] Device Token obtained successfully:', token.substring(0, 15) + '...');
      return token;
    } else {
      console.warn('[FCM] No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (error) {
    console.error('[FCM] Error retrieving FCM device token:', error);
    return null;
  }
}

/**
 * Listen for foreground FCM Push Notifications
 */
export async function onForegroundMessage(callback: (payload: any) => void): Promise<(() => void) | null> {
  try {
    const messaging = await getFCMMessaging();
    if (!messaging) return null;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground notification received:', payload);
      callback(payload);
    });
    return unsubscribe;
  } catch (err) {
    console.warn('[FCM] Could not setup foreground message listener:', err);
    return null;
  }
}
