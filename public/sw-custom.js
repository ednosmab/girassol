// public/sw-custom.js

// --- Atualização controlada por mensagem ---
// O client envia { type: 'SKIP_WAITING' } quando quer ativar este SW.
// Isso é seguro porque só ativamos em background (ver useServiceWorkerUpdate.ts).
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  if (event.data) {
    const dados = event.data.json();
    const titulo = typeof dados.title === 'string' ? dados.title.substring(0, 100) : 'Meu Girassol';
    const body = typeof dados.body === 'string' ? dados.body.substring(0, 300) : '';
    const allowedIcons = ['/icon-192.png', '/icon-512.png'];
    const icon = allowedIcons.includes(dados.image) ? dados.image : '/icon-192.png';
    const options = {
      body,
      icon,
      vibrate: [300, 100, 300],
      data: { dateOfArrival: Date.now() }
    };
    event.waitUntil(
      self.registration.showNotification(titulo, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
