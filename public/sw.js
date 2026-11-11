// Service Worker for system notifications and outside-the-app lesson alerts
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle notification click from outside the app (phone home screen, lockscreen, or desktop)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  const data = event.notification.data || {};
  const urlToOpen = data.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and dispatch action message
      for (const client of windowClients) {
        if ('focus' in client) {
          return client.focus().then(() => {
            client.postMessage({
              type: 'NOTIFICATION_ACTION',
              action: action || 'tap',
              lessonId: data.lessonId,
              extra: data
            });
          });
        }
      }
      // If no window is open, open a new window with the app
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push events if push manager is configured
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const title = payload.title || '⏰ تذكير موعد الحصة';
    const options = {
      body: payload.body || '',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: payload.tag || 'lesson_alarm',
      requireInteraction: true,
      vibrate: [500, 200, 500, 200, 500],
      data: payload.data || {},
      actions: [
        { action: 'start', title: '▶️ بدء الحصة' },
        { action: 'snooze', title: '⏰ غفوة 5 دقائق' },
        { action: 'dismiss', title: '✖️ إيقاف' }
      ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Plain text fallback
    event.waitUntil(
      self.registration.showNotification('⏰ تنبيه الحصة', {
        body: event.data.text(),
        icon: '/icon.png',
        badge: '/icon.png',
        requireInteraction: true
      })
    );
  }
});
