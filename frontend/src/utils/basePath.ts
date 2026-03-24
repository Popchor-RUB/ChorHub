export function normalizeBasePath(basePath: string | undefined): string {
  const raw = basePath ?? '/';
  return `/${raw.replace(/^\/+|\/+$/g, '')}/`.replace(/\/{2,}/g, '/');
}

export function withBasePath(path: string, basePath: string | undefined): string {
  const normalizedBase = normalizeBasePath(basePath);
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}
