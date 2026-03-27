const rateLimit = require('express-rate-limit');

const windowMs = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const max = parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 50;

/**
 * Límite por IP sobre POST /api/admin_login (complementa bloqueo por credencial en BD).
 */
exports.adminLoginRateLimiter = rateLimit({
  windowMs,
  max,
  message: {
    message: 'Demasiados intentos desde esta red. Espere unos minutos e intente de nuevo.',
    data: undefined
  },
  standardHeaders: true,
  legacyHeaders: false
});
