import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getDatabase,
  Database,
  ref,
  push,
  onChildAdded,
  off,
  serverTimestamp,
  query,
  limitToLast
} from 'firebase/database';

const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyDummyKeyForFirebaseWebClient",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "mateen-quran.firebaseapp.com",
  databaseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_URL) || "https://mateen-quran-default-rtdb.firebaseio.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "mateen-quran",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "mateen-quran.appspot.com",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "1234567890",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:1234567890:web:abcdef"
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  database = getDatabase(app);
} catch (err) {
  console.warn("Firebase Realtime Database initialization warning:", err);
}

export {
  app,
  database,
  ref,
  push,
  onChildAdded,
  off,
  serverTimestamp,
  query,
  limitToLast
};
