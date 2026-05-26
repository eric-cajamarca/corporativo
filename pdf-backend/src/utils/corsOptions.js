/**
 * CORS alineado con backAppC (DESPLIEGUE-LAN.md, Nginx + SPA mismo host).
 *
 * pdf-backend normalmente NO se consume desde el navegador (backAppC lo
 * llama via axios), por lo que no necesita ningun origen LAN por defecto.
 * Si por algun motivo se llama desde el front (devtools, debug), se aplica
 * la misma politica que en backAppC:
 *   - En production: LAN solo si CORS_ALLOW_LAN=1 explicito.
 *   - En desarrollo: LAN permitida salvo CORS_ALLOW_LAN=0.
 */

function buildStaticAllowedOrigins() {
  const extra = (process.env.CORS_ORIGIN || process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    process.env.FRONTEND_URL,
    ...extra
  ].filter(Boolean);
}

function corsLanAllowedByConfig() {
  const v = process.env.CORS_ALLOW_LAN;
  if (process.env.NODE_ENV === 'production') return v === '1';
  return v !== '0';
}

function isPrivateLanOrigin(origin) {
  if (!corsLanAllowedByConfig()) return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return true;
    if (h.endsWith('.local')) return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}

function createCorsMiddleware() {
  return require('cors')({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const allowed = buildStaticAllowedOrigins();
      if (allowed.includes(origin)) return callback(null, true);
      if (isPrivateLanOrigin(origin)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept']
  });
}

module.exports = { createCorsMiddleware, buildStaticAllowedOrigins, isPrivateLanOrigin };
