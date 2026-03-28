const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const certDir = path.join(__dirname, '..', '.cert');
const keyPath = path.join(certDir, 'dev-key.pem');
const certPath = path.join(certDir, 'dev-cert.pem');

function getLanIPv4Addresses() {
  const addresses = [];
  const interfaces = os.networkInterfaces();
  for (const ifaceAddresses of Object.values(interfaces)) {
    if (!ifaceAddresses) continue;
    for (const address of ifaceAddresses) {
      const family = typeof address.family === 'string' ? address.family : String(address.family);
      if (family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return Array.from(new Set(addresses));
}

function createCertificate() {
  const lanIps = getLanIPv4Addresses();
  const sanEntries = ['DNS:localhost', 'IP:127.0.0.1', ...lanIps.map((ip) => `IP:${ip}`)];
  const san = sanEntries.join(',');

  fs.mkdirSync(certDir, { recursive: true });

  const args = [
    'req',
    '-x509',
    '-nodes',
    '-newkey',
    'rsa:2048',
    '-keyout',
    keyPath,
    '-out',
    certPath,
    '-days',
    '365',
    '-subj',
    '/CN=localhost',
    '-addext',
    `subjectAltName=${san}`,
  ];

  const result = spawnSync('openssl', args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || 'unknown error';
    throw new Error(`openssl failed: ${stderr}`);
  }

  return { lanIps };
}

try {
  const force = process.env.FORCE_DEV_CERT_REGEN === '1';
  const hasExistingCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

  if (!hasExistingCert || force) {
    const { lanIps } = createCertificate();
    const ipInfo = lanIps.length > 0 ? ` (${lanIps.join(', ')})` : '';
    console.log(`Generated dev TLS certificate${ipInfo}`);
  } else {
    console.log('Using existing dev TLS certificate');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Could not generate dev TLS certificate: ${message}`);
  console.warn('Dev server will fall back to HTTP unless certificates are provided.');
}
