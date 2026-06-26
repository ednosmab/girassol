// public/sw-custom.js

function swLog(source, message) {
  console.log(`[SW] [${source}] ${message}`);
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'SW_LOG', source, message });
    });
  });
}

swLog('INIT', `Service Worker carregado em ${new Date().toLocaleTimeString('pt-BR')}`);

self.addEventListener('install', (event) => {
  swLog('INSTALL', 'Service Worker instalado');
});

self.addEventListener('activate', (event) => {
  swLog('ACTIVATE', 'Service Worker ativado');
});

// --- Atualização controlada por mensagem ---
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'SKIP_WAITING') {
    swLog('MESSAGE', 'SKIP_WAITING recebido, ativando novo SW...');
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  swLog('PUSH', `Push event recebido! Timestamp: ${new Date().toLocaleTimeString('pt-BR')}`);

  if (!event.data) {
    swLog('PUSH', 'event.data é NULL — sem dados no push');
    return;
  }

  const rawText = event.data.text();
  swLog('PUSH', `Dados brutos (text): ${rawText.substring(0, 200)}`);

  let dados;
  try {
    dados = event.data.json();
    swLog('PUSH', `JSON parseado: title="${dados.title}", body="${dados.body?.substring(0, 80)}..."`);
  } catch (e) {
    swLog('PUSH', `Falha ao parsear JSON: ${e.message}`);
    return;
  }

  const titulo = typeof dados.title === 'string' ? dados.title.substring(0, 100) : 'Meu Girassol';
  const body = typeof dados.body === 'string' ? dados.body.substring(0, 300) : '';
  const allowedIcons = ['/icon-192.png', '/icon-512.png'];
  const icon = allowedIcons.includes(dados.image) ? dados.image : '/icon-192.png';

  swLog('PUSH', `Notificação: titulo="${titulo}", body="${body.substring(0, 60)}...", icon="${icon}"`);

  const options = {
    body,
    icon,
    vibrate: [300, 100, 300],
    data: { dateOfArrival: Date.now() }
  };

  event.waitUntil(
    self.registration.showNotification(titulo, options).then(() => {
      swLog('PUSH', 'showNotification executada com SUCESSO');
    }).catch((e) => {
      swLog('PUSH', `showNotification FALHOU: ${e.message}`);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  swLog('CLICK', 'Notification click! Focusando janela...');
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/') && 'focus' in client) {
          swLog('CLICK', 'Janela encontrada, focando...');
          return client.focus();
        }
      }
      if (clients.openWindow) {
        swLog('CLICK', 'Nenhuma janela encontrada, abrindo nova...');
        return clients.openWindow('/');
      }
    })
  );
});
