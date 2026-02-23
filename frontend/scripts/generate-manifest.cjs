const fs = require('fs');
const path = require('path');

const basePath = process.env.BASE_PATH ?? '/';

const manifest = {
  name: 'ChorHub',
  short_name: 'ChorHub',
  start_url: basePath,
  display: 'standalone',
  background_color: '#ffffff',
  theme_color: '#006FEE',
  icons: [
    { src: `${basePath}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
    { src: `${basePath}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};

const outputPath = path.join(__dirname, '..', 'public', 'manifest.json');
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log(`Generated manifest.json with base path: ${basePath}`);
