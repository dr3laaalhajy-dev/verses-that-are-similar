import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAnalytics, isSupported as isAnalyticsSupported, Analytics } from 'firebase/analytics';
import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';

// Firebase Client Configuration - reads from Vite env variables with fallback to project settings
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAux6Fg_GonGCh0OBoyGG7GAFNjXBc8NEk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "mateen-229f8.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mateen-229f8",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "mateen-229f8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "454602577030",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:454602577030:web:551f014003683a63e92d07",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LWSXDD71TM"
};

// VAPID Key (Public Key for Web Push Certificates)
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

// Initialize Firebase App instance
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Analytics safely
export let analytics: Analytics | null = null;
if (typeof window !== 'undefined') {
  isAnalyticsSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
      console.log('[Firebase] Analytics initialized successfully');
    }
  }).catch((err) => {
    console.debug('[Firebase] Analytics not supported in this environment:', err);
  });
}

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
