// public/sw-custom.js
self.addEventListener('push', (event) => {
  if (event.data) {
    const dados = event.data.json();
    const options = {
      body: dados.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      image: dados.image || '/icon-192.png',
      vibrate: [300, 100, 300],
      data: { dateOfArrival: Date.now() }
    };
    event.waitUntil(
      self.registration.showNotification(dados.title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
