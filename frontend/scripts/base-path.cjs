function normalizeBasePath(basePath) {
  const raw = basePath ?? '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/\/{2,}/g, '/');
}

module.exports = { normalizeBasePath };
