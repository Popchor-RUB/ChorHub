const fs = require('fs');
const path = require('path');

const basePath = process.env.BASE_PATH ?? '/';

const serviceWorker = `// Auto-generated service worker - do not edit manually
const BASE_PATH = '${basePath}';

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title ?? 'ChorHub';
  const options = {
    body: data.body ?? '',
    icon: BASE_PATH + 'icons/icon-192.png',
    badge: BASE_PATH + 'icons/icon-192.png',
    data: { url: data.url ?? BASE_PATH },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? BASE_PATH;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
`;

const outputPath = path.join(__dirname, '..', 'public', 'sw.js');
fs.writeFileSync(outputPath, serviceWorker);
console.log(`Generated sw.js with base path: ${basePath}`);
