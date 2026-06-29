const jwt = require('jsonwebtoken');
const moment = require('moment');
const { getJwtSecret } = require('../config/jwt.config');
const { getPool } = require('../utils/dbPool.util');
const refreshTokenService = require('../services/refreshToken.service');

async function validarSesionEnBd(req) {
  if (req.sessionValidada) {
    return req.sessionValida === true;
  }
  try {
    const pool = req.dbPool || await getPool();
    const ok = await refreshTokenService.validarSesionRequest(pool, req);
    req.sessionValidada = true;
    req.sessionValida = ok === true;
    return req.sessionValida === true;
  } catch (e) {
    console.error('auth validarSesionEnBd:', e.message);
    req.sessionValidada = true;
    req.sessionValida = false;
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
