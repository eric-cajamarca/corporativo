const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sesionRefreshTokenRepository = require('../repositories/sesionRefreshToken.repository');
const jwtHelper = require('../helpers/jwt');
const { obtenerIpCliente } = require('../utils/clientIp.util');

const REFRESH_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS, 10) || 7;

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

function generarTokenRefreshRaw() {
  return crypto.randomBytes(48).toString('hex');
}

function cookieOpts(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
    path: '/',
    maxAge: maxAgeMs
  };
}

/**
 * Crea refresh en BD y fija cookies de acceso + refresh.
 */
exports.emitirSesion = async (pool, datosUsuario, res, req) => {
  const idRefresh = uuidv4();
  const rawRefresh = generarTokenRefreshRaw();
  const tokenHash = hashToken(rawRefresh);
  const expira = moment().add(REFRESH_DAYS, 'days').toDate();

  const ip = req ? obtenerIpCliente(req) : null;
  const userAgent = req && req.headers && req.headers['user-agent'];

  await sesionRefreshTokenRepository.insertar(pool, {
    idRefresh,
    idUsuario: datosUsuario.idUsuario,
    idEmpresa: datosUsuario.idEmpresa,
    tokenHash,
    expira,
    ipCrear: ip,
    userAgentCrear: userAgent ? String(userAgent).slice(0, 400) : null
  });

  const accessToken = jwtHelper.createToken(datosUsuario);
  const accessMs = jwtHelper.getAccessTokenMaxAgeMs();

  res.cookie('token', accessToken, cookieOpts(accessMs));
  res.cookie('refreshToken', rawRefresh, cookieOpts(REFRESH_DAYS * 24 * 60 * 60 * 1000));

  return { idRefresh };
};

/**
 * Rota refresh: revoca el actual y emite nuevas cookies.
 */
exports.rotarSesion = async (pool, rawRefresh, res, req) => {
  if (!rawRefresh || String(rawRefresh).length < 32) {
    throw new Error('REFRESH_INVALIDO');
  }
  const h = hashToken(rawRefresh);
  const row = await sesionRefreshTokenRepository.buscarActivoPorHash(pool, h);
  if (!row) {
    throw new Error('REFRESH_INVALIDO');
  }

  const authService = require('./auth.service');
  const datosUsuario = await authService.reconstruirDatosUsuarioParaToken(
    pool,
    row.idUsuario,
    row.idEmpresa
  );
  if (!datosUsuario) {
    await sesionRefreshTokenRepository.marcarRevocado(pool, row.idRefresh);
    throw new Error('REFRESH_USUARIO_INVALIDO');
  }

  await sesionRefreshTokenRepository.marcarRevocado(pool, row.idRefresh);

  await exports.emitirSesion(pool, datosUsuario, res, req);
  return { datosUsuario };
};

exports.revocarPorTokenRaw = async (pool, rawRefresh) => {
  if (!rawRefresh) return;
  const h = hashToken(rawRefresh);
  const row = await sesionRefreshTokenRepository.buscarActivoPorHash(pool, h);
  if (row) {
    await sesionRefreshTokenRepository.marcarRevocado(pool, row.idRefresh);
  }
};

exports.revocarTodosUsuarioEmpresa = async (pool, idUsuario, idEmpresa) => {
  await sesionRefreshTokenRepository.revocarTodosUsuarioEmpresa(pool, idUsuario, idEmpresa);
};

exports.limpiarCookies = (res) => {
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
    path: '/'
  };
  res.clearCookie('token', base);
  res.clearCookie('refreshToken', base);
};
