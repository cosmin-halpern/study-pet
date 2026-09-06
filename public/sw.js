self.addEventListener('push', (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title || 'Your pet', {
      body: d.body || 'Nobody has checked in today.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/' },
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});