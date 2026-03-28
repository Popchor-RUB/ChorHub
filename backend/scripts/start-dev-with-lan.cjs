const os = require('node:os');
const { spawnSync } = require('node:child_process');

function resolveLanIPv4() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    if (!addresses) continue;
    for (const address of addresses) {
      const family = typeof address.family === 'string' ? address.family : String(address.family);
      if (family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
}

function run(command, args, env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const lanIp = resolveLanIPv4();
const frontendPort = process.env.FRONTEND_PORT ?? '5173';
const backendPort = process.env.PORT ?? '3000';
const frontendProtocol = process.env.FRONTEND_PROTOCOL ?? 'https';

const defaultAppUrl = lanIp
  ? `${frontendProtocol}://${lanIp}:${frontendPort}`
  : `${frontendProtocol}://localhost:${frontendPort}`;

const providedAppUrl = process.env.APP_URL?.trim();
const localhostUrlPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i;
const shouldAutoSetAppUrl = !providedAppUrl || localhostUrlPattern.test(providedAppUrl);
const appUrl = shouldAutoSetAppUrl ? defaultAppUrl : providedAppUrl;
const lanOriginHttp = lanIp ? `http://${lanIp}:${frontendPort}` : null;
const lanOriginHttps = lanIp ? `https://${lanIp}:${frontendPort}` : null;
const corsOrigins = [
  appUrl,
  lanOriginHttp,
  lanOriginHttps,
  `http://localhost:${frontendPort}`,
  `https://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
  `https://127.0.0.1:${frontendPort}`,
].filter(Boolean).join(',');

const env = {
  ...process.env,
  APP_URL: appUrl,
  CORS_ORIGINS: process.env.CORS_ORIGINS ?? corsOrigins,
  ENABLE_DEBUG_LOGGING: process.env.ENABLE_DEBUG_LOGGING ?? '1',
  HOST: process.env.HOST ?? '0.0.0.0',
  PORT: backendPort,
};

const apiBaseUrl = lanIp
  ? `http://${lanIp}:${backendPort}`
  : `http://localhost:${backendPort}`;

console.log(`[dev] APP_URL=${env.APP_URL}`);
console.log(`[dev] CORS_ORIGINS=${env.CORS_ORIGINS}`);
console.log(`[dev] API=${apiBaseUrl}`);

run('npx', ['prisma', 'generate'], env);
run('npx', ['nest', 'start', '--watch'], env);
