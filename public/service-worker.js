// ==============================================================================
// Service Worker الأساسي لتطبيق متين (PWA & Web Push Service Worker)
// متوافق مع معيار Web Push API ونظام Apple iOS 16.4+ (Safari PWA)
// ==============================================================================

importScripts('/firebase-messaging-sw.js');

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

