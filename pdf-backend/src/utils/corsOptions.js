/**
 * CORS alineado con backAppC / DESPLIEGUE-LAN.md (Nginx + SPA mismo host).
 * CORS_ALLOW_LAN=0 → solo orígenes explícitos.
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

function isPrivateLanOrigin(origin) {
  if (process.env.CORS_ALLOW_LAN === '0') return false;
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
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept']
  });
}

module.exports = { createCorsMiddleware, buildStaticAllowedOrigins, isPrivateLanOrigin };
