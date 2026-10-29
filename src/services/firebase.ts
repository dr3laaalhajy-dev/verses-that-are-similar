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

// 2. التحقق من متغيرات البيئة (Firebase Config): قراءة databaseURL والمتغيرات من .env
const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || '';
const authDomain = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || '';
const databaseURL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_URL) || '';
const projectId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || '';
const storageBucket = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || '';
const messagingSenderId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || '';
const appId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || '';

// طباعة تشخيصية واضحة لحالة متغيرات البيئة في الـ Console
if (!databaseURL) {
  console.error(
    '[Firebase Config Error] VITE_FIREBASE_DATABASE_URL غير معرّف في ملف .env!\n' +
    'لن تتمكن نسخة الويب من استقبال أو إرسال أي تفاعلات مع الأندرويد حتى يتم وضع رابط قاعدة البيانات في .env'
  );
} else {
  console.log('[Firebase Config] تم تحميل رابط Realtime Database بنجاح:', databaseURL);
}

const firebaseConfig = {
  apiKey: apiKey || 'AIzaSyDummyKeyForFirebaseWebClient',
  authDomain: authDomain || (projectId ? `${projectId}.firebaseapp.com` : 'mateen-quran.firebaseapp.com'),
  databaseURL: databaseURL || 'https://mateen-quran-default-rtdb.firebaseio.com',
  projectId: projectId || 'mateen-quran',
  storageBucket: storageBucket || (projectId ? `${projectId}.appspot.com` : 'mateen-quran.appspot.com'),
  messagingSenderId: messagingSenderId || '1234567890',
  appId: appId || '1:1234567890:web:abcdef'
};

let app: FirebaseApp | null = null;
let database: Database | null = null;

try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  database = databaseURL ? getDatabase(app, databaseURL) : getDatabase(app);
} catch (err) {
  console.error('[Firebase Init Error] فشل تهيئة Firebase Realtime Database:', err);
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
