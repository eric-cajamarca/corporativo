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

const recoveryWindowMs =
  parseInt(process.env.PASSWORD_RECOVERY_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const recoveryMax =
  parseInt(process.env.PASSWORD_RECOVERY_RATE_LIMIT_MAX, 10) || 8;

/** POST /api/recuperar-password — evita abuso y enumeración masiva */
exports.recuperarPasswordRateLimiter = rateLimit({
  windowMs: recoveryWindowMs,
  max: recoveryMax,
  message: {
    message: 'Demasiadas solicitudes de recuperación. Espere unos minutos e intente de nuevo.',
    data: undefined
  },
  standardHeaders: true,
  legacyHeaders: false
});

const resetWindowMs =
  parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const resetMax = parseInt(process.env.PASSWORD_RESET_RATE_LIMIT_MAX, 10) || 20;

/** POST /api/restablecer-password */
exports.restablecerPasswordRateLimiter = rateLimit({
  windowMs: resetWindowMs,
  max: resetMax,
  message: {
    message: 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
    data: undefined
  },
  standardHeaders: true,
  legacyHeaders: false
});
