const jwt = require('jsonwebtoken');
const moment = require('moment');
const sql = require('mssql');
const dbConfig = require('../dbconfig');
const { getJwtSecret } = require('../config/jwt.config');
const refreshTokenService = require('../services/refreshToken.service');

async function validarSesionEnBd(req) {
  try {
    const pool = await sql.connect(dbConfig);
    return refreshTokenService.validarSesionRequest(pool, req);
  } catch (e) {
    console.error('auth validarSesionEnBd:', e.message);
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
