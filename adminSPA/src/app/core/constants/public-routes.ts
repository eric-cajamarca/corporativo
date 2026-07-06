/** Rutas accesibles sin autenticación (alineadas con app.routes). */
export const PUBLIC_ROUTE_PREFIXES = [
  '/login-empresa',
  '/crear-empresa',
  '/verificar-empresa',
  '/publico',
  '/politicas',
  '/planes',
  '/suscribirse',
  '/recuperar-password'
] as const;

/** Extrae solo el path de una URL del router o del navegador. */
export function extractPathFromUrl(url: string | null | undefined): string {
  const raw = (url ?? '').trim();
  if (!raw) {
    return '';
  }

  try {
    if (raw.includes('://')) {
      return normalizePath(new URL(raw).pathname);
    }
  } catch {
    /* ignore */
  }

  let path = raw.split('?')[0].split('#')[0];
  if (path.startsWith('#')) {
    path = path.slice(1);
  }

  return normalizePath(path);
}

function normalizePath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  const cleaned = withSlash.toLowerCase().replace(/\/+$/, '');
  return cleaned || '/';
}

/** Indica si la URL es pública (misma lógica que crear-empresa / planes). */
export function isPublicUrl(url: string | null | undefined): boolean {
  const path = extractPathFromUrl(url);
  if (!path || path === '/') {
    return true;
  }
  return PUBLIC_ROUTE_PREFIXES.some(
    (route) => path === route || path.startsWith(`${route}/`)
  );
}

/** Usa la barra de direcciones real (fiable antes de que el router termine de iniciar). */
export function isPublicBrowserLocation(): boolean {
  try {
    if (typeof globalThis === 'undefined' || !globalThis.location?.pathname) {
      return false;
    }
    const path = `${globalThis.location.pathname}${globalThis.location.search || ''}`;
    return isPublicUrl(path);
  } catch {
    return false;
  }
}
