// ==============================================================================
// Service Worker للإشعارات الخارجية في الخلفية (Background FCM Push Notifications)
// تطبيق متين - لعلوم ومتشابهات القرآن الكريم
// ==============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// إعدادات مشروع Firebase (mateen-229f8)
const firebaseConfig = {
  apiKey: "AIzaSyAux6Fg_GonGCh0OBoyGG7GAFNjXBc8NEk",
  authDomain: "mateen-229f8.firebaseapp.com",
  projectId: "mateen-229f8",
  storageBucket: "mateen-229f8.firebasestorage.app",
  messagingSenderId: "454602577030",
  appId: "1:454602577030:web:551f014003683a63e92d07",
  measurementId: "G-LWSXDD71TM"
};

// تهيئة تطبيق Firebase داخل الـ Service Worker
if (firebase.apps.length === 0) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// التعامل مع الإشعار عند وصوله والتطبيق في الخلفية أو مغلق
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // إذا كان الإشعار يحتوي على كائن notification، فالمتصفح/نظام التشغيل يقوم بعرضه تلقائياً!
  // استدعاء showNotification هنا سيؤدي حتماً لظهور إشعار ثانٍ مكرر على شاشة القفل.
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] Notification payload handled automatically by browser/OS. Skipping duplicate showNotification.');
    return;
  }

  // يتم العرض اليدوي فقط إذا كانت الرسالة عبارة عن بيانات خالصة (Data-only message)
  const rawUrl = payload.data?.url || payload.data?.target_url || payload.fcmOptions?.link || '/';
  const fullUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  let relativePath = payload.data?.relative_url || '';
  if (!relativePath || relativePath.startsWith('http')) {
    try {
      const parsed = new URL(fullUrl, self.location.origin);
      relativePath = parsed.pathname + parsed.search + parsed.hash;
    } catch (e) {
      relativePath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    }
  }

  const notificationTitle = payload.data?.title || 'تطبيق متين 🔔';
  const notificationTag = payload.data?.tag || 'mateen-notification';
  const notificationOptions = {
    body: payload.data?.body || 'لديك تنبيه جديد من تطبيق متين',
    icon: '/logo.webp',
    badge: '/logo-mark.webp',
    dir: 'rtl',
    lang: 'ar',
    tag: notificationTag,
    renotify: false,
    vibrate: [200, 100, 200],
    data: {
      url: fullUrl,
      fullUrl: fullUrl,
      relative_url: relativePath,
      ...payload.data
    },
    actions: [
      { action: 'open_app', title: 'فتح التطبيق' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// التعامل مع حدث النقر على الإشعار من شريط التنبيهات بالهاتف / المتصفح
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const rawUrl = data.url || data.link || '/';

  // 1. الرابط الكامل لفتح نافذة جديدة في حال كان التطبيق مغلقاً
  const fullUrl = (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))
    ? rawUrl
    : new URL(rawUrl, self.location.origin).href;

  // 2. المسار النسبي لإرساله عبر postMessage دون إعادة تحميل الصفحة إذا كان التطبيق مفتوحاً
  let relativePath = data.relative_url || '';
  if (!relativePath || relativePath.startsWith('http')) {
    try {
      const parsed = new URL(fullUrl, self.location.origin);
      relativePath = parsed.pathname + parsed.search + parsed.hash;
    } catch (e) {
      relativePath = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    }
  }
  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const explicitRoute = data.route || relativePath;

      // إذا كان التطبيق مفتوحاً في الخلفية، استخدم client.postMessage لإرسال المسار النسبي دون تحديث الصفحة
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'DEEP_LINK_NAVIGATE',
            url: relativePath,
            route: explicitRoute,
            fullUrl: fullUrl,
            data: { ...data, route: explicitRoute }
          });

          return client.focus();
        }
      }

      // إذا لم يكن التطبيق مفتوحاً، افتح نافذة جديدة بالرابط الكامل المؤكد
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});
