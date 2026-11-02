// ==============================================================================
// Service Worker للإشعارات الخارجية في الخلفية (Background FCM Push Notifications)
// تطبيق متين - لعلوم ومتشابهات القرآن الكريم
// ==============================================================================

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

// إعدادات Firebase الافتراضية للـ Service Worker
const firebaseConfig = {
  apiKey: "AIzaSyPlaceholder_Config_Only",
  authDomain: "matin-quran.firebaseapp.com",
  projectId: "matin-quran",
  storageBucket: "matin-quran.appspot.com",
  messagingSenderId: "100000000000",
  appId: "1:100000000000:web:abcdef1234567890"
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
      // إذا كان هناك تبويب مفتوح بالفعل للتطبيق، قم بالتركيز عليه
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl !== '/') {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // إذا لم يكن التطبيق مفتوحاً، افتح نافذة جديدة
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
