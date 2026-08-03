const jwt = require('jsonwebtoken');
const moment = require('moment');
const { getJwtSecret } = require('../config/jwt.config');
const { getPool } = require('../utils/dbPool.util');
const refreshTokenService = require('../services/refreshToken.service');

/** TTL cache de sesión en memoria (ms). 0 = desactivado. Default 30s. */
const SESSION_CACHE_TTL_MS = Math.max(0, parseInt(process.env.SESSION_CACHE_TTL_MS || '30000', 10) || 0);
/** @type {Map<string, { ok: boolean, exp: number }>} */
const sessionCache = new Map();

function sessionCacheKey(user) {
  if (!user) return '';
  return `${user.sid || ''}:${user.sub || ''}:${user.empresa || ''}`;
}

function getCachedSession(key) {
  if (!SESSION_CACHE_TTL_MS || !key) return null;
  const hit = sessionCache.get(key);
  if (!hit) return null;
  if (hit.exp <= Date.now()) {
    sessionCache.delete(key);
    return null;
  }
  return hit.ok;
}

function setCachedSession(key, ok) {
  if (!SESSION_CACHE_TTL_MS || !key) return;
  sessionCache.set(key, { ok: ok === true, exp: Date.now() + SESSION_CACHE_TTL_MS });
  // Evitar crecimiento indefinido en VPS con muchos usuarios
  if (sessionCache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of sessionCache) {
      if (v.exp <= now) sessionCache.delete(k);
      if (sessionCache.size <= 4000) break;
    }
  }
}

/** Invalidar cache al revocar sesión (logout / cerrar dispositivo). */
exports.invalidateSessionCache = function invalidateSessionCache(userOrSid, sub, empresa) {
  if (userOrSid && typeof userOrSid === 'object') {
    sessionCache.delete(sessionCacheKey(userOrSid));
    return;
  }
  if (userOrSid) {
    sessionCache.delete(`${userOrSid}:${sub || ''}:${empresa || ''}`);
  }
  // Si solo hay usuario/empresa (revocar todas), limpiar claves que coincidan
  if (sub && empresa) {
    const needle = `:${String(sub).toLowerCase()}:${String(empresa).toLowerCase()}`;
    for (const k of [...sessionCache.keys()]) {
      if (String(k).toLowerCase().endsWith(needle)) sessionCache.delete(k);
    }
  }
};

async function validarSesionEnBd(req) {
  if (req.sessionValidada) {
    return req.sessionValida === true;
  }
  const key = sessionCacheKey(req.user);
  const cached = getCachedSession(key);
  if (cached !== null) {
    req.sessionValidada = true;
    req.sessionValida = cached;
    return cached;
  }
  try {
    const pool = req.dbPool || await getPool();
    const ok = await refreshTokenService.validarSesionRequest(pool, req);
    req.sessionValidada = true;
    req.sessionValida = ok === true;
    setCachedSession(key, req.sessionValida);
    return req.sessionValida === true;
  } catch (e) {
    console.error('auth validarSesionEnBd:', e.message);
    req.sessionValidada = true;
    req.sessionValida = false;
    setCachedSession(key, false);
    return false;
  }
}

exports.auth = async function (req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(403).send({ message: 'NoTokenError' });
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());

    if (payload.exp <= moment().unix()) {
      return res.status(403).send({ message: 'TokenExpirado' });
    }

    req.user = payload;

    const sesionOk = await validarSesionEnBd(req);
    if (!sesionOk) {
      return res.status(403).send({ message: 'SesionRevocada' });
    }

    next();
  } catch (error) {
    return res.status(403).send({ message: 'InvalidToken' });
  }
};

/**
 * Mismo flujo que auth pero sin devolver 403: si no hay token o es inválido, solo llama next().
 */
exports.optionalAuth = async function (req, res, next) {
  const token = req.cookies && req.cookies.token;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());
    if (payload.exp <= moment().unix()) {
      return next();
    }
    req.user = payload;
    const sesionOk = await validarSesionEnBd(req);
    if (!sesionOk) {
      return next();
    }
  } catch (error) {
    /* token inválido */
  }
  next();
};
