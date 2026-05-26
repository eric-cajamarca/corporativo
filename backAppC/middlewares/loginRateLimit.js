const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const windowMs = parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const max = parseInt(process.env.LOGIN_RATE_LIMIT_MAX, 10) || 5;

const mfaWindowMs = parseInt(process.env.MFA_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000;
const mfaMax = parseInt(process.env.MFA_RATE_LIMIT_MAX, 10) || 10;

function normalizarEmail(req) {
  const email = req && req.body && req.body.email ? String(req.body.email).toLowerCase().trim() : '';
  return email;
}

function keyLoginIpEmail(req, res) {
  return `${ipKeyGenerator(req, res)}|${normalizarEmail(req)}`;
}

function keyMfaIpToken(req, res) {
  const tok = req && req.cookies && req.cookies.pendingToken ? String(req.cookies.pendingToken).slice(-32) : '';
  return `${ipKeyGenerator(req, res)}|${tok}`;
}

exports.adminLoginRateLimiter = rateLimit({
  windowMs,
  max,
  keyGenerator: keyLoginIpEmail,
  skipSuccessfulRequests: true,
  message: {
    message: 'Demasiados intentos desde esta red. Espere unos minutos e intente de nuevo.',
    data: undefined
  },
  standardHeaders: true,
  legacyHeaders: false
});

exports.adminMfaRateLimiter = rateLimit({
  windowMs: mfaWindowMs,
  max: mfaMax,
  keyGenerator: keyMfaIpToken,
  skipSuccessfulRequests: true,
  message: {
    message: 'Demasiados intentos. Espere unos minutos e intente de nuevo.',
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
