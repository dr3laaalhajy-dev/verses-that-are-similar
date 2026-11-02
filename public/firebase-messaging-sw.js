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

  const notificationTitle = payload.notification?.title || payload.data?.title || 'تطبيق متين 🔔';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'لديك تنبيه جديد من تطبيق متين',
    icon: '/logo.png',
    badge: '/logo-mark.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || '/',
      ...payload.data
    },
    actions: [
      { action: 'open_app', title: 'فتح التطبيق' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// التعامل مع حدث النقر على الإشعار من شريط التنبيهات بالهاتف / المتصفح
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // إذا كان هناك تبويب مفتوح بالفعل، قم بإرسال رسالة التوجيه الذكي وتركيزه
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'DEEP_LINK_NAVIGATE',
            url: targetUrl,
            data: event.notification.data
          });

          if ('navigate' in client && !client.url.endsWith(targetUrl)) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // إذا لم يكن التطبيق مفتوحاً، افتح نافذة جديدة بالرابط المحدد
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
