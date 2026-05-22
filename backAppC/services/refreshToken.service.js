const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const sesionRefreshTokenRepository = require('../repositories/sesionRefreshToken.repository');
const jwtHelper = require('../helpers/jwt');
const { obtenerIpCliente } = require('../utils/clientIp.util');
const { formatearFechaHoraLima } = require('../utils/fechaDisplay.util');

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
 * Si el refresh ya fue revocado (p. ej. cerrado desde "Sesiones y dispositivos"), solo falla
 * ESE navegador — no se revocan las demás sesiones activas.
 */
exports.rotarSesion = async (pool, rawRefresh, res, req) => {
  if (!rawRefresh || String(rawRefresh).length < 32) {
    throw new Error('REFRESH_INVALIDO');
  }
  const h = hashToken(rawRefresh);
  const row = await sesionRefreshTokenRepository.buscarActivoPorHash(pool, h);
  if (!row) {
    const revocado = await sesionRefreshTokenRepository.buscarRevocadoPorHash(pool, h);
    if (revocado) {
      const seguridadAuditoriaService = require('./seguridadAuditoria.service');
      await seguridadAuditoriaService.registrar(pool, req, {
        idEmpresa: revocado.idEmpresa,
        idUsuario: revocado.idUsuario,
        tipo: 'REFRESH_SESION_CERRADA',
        detalle: 'Refresh en sesion ya revocada (cierre remoto o logout)',
        ipCliente: obtenerIpCliente(req)
      });
      throw new Error('REFRESH_SESION_CERRADA');
    }
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

exports.revocarTodosPorEmpresa = async (pool, idEmpresa) => {
  await sesionRefreshTokenRepository.revocarTodosPorEmpresa(pool, idEmpresa);
};

/**
 * Lista sesiones activas (sin exponer tokenHash); marca la de la cookie actual.
 */
exports.listarSesionesDispositivos = async (pool, idUsuario, idEmpresa, rawRefreshActual) => {
  const rows = await sesionRefreshTokenRepository.listarActivosPorUsuarioEmpresa(pool, idUsuario, idEmpresa);
  const hashActual =
    rawRefreshActual && String(rawRefreshActual).length >= 32 ? hashToken(String(rawRefreshActual)) : null;
  return rows.map((r) => ({
    idRefresh: r.idRefresh,
    expira: formatearFechaHoraLima(r.expira),
    creado: formatearFechaHoraLima(r.creado),
    ipCrear: r.ipCrear,
    userAgentCrear: r.userAgentCrear,
    esDispositivoActual: Boolean(hashActual && r.tokenHash === hashActual)
  }));
};

/**
 * Valida que la sesión del JWT (sid) o la cookie refresh sigan activas en BD.
 */
exports.validarSesionRequest = async (pool, req) => {
  const user = req.user;
  if (!user || !user.sub || !user.empresa) return false;

  if (user.sid) {
    return sesionRefreshTokenRepository.existeSesionActiva(pool, user.sid, user.sub, user.empresa);
  }

  const raw = req.cookies && req.cookies.refreshToken;
  if (!raw || String(raw).length < 32) return false;
  const h = hashToken(String(raw));
  const row = await sesionRefreshTokenRepository.buscarActivoPorHash(pool, h);
  return Boolean(
    row &&
    String(row.idUsuario).toLowerCase() === String(user.sub).toLowerCase() &&
    String(row.idEmpresa).toLowerCase() === String(user.empresa).toLowerCase()
  );
};

exports.revocarSesionDispositivo = async (pool, idRefresh, idUsuario, idEmpresa) => {
  const n = await sesionRefreshTokenRepository.revocarPorIdRefreshSiPertenece(pool, idRefresh, idUsuario, idEmpresa);
  if (!n) {
    throw new Error('SESION_NO_ENCONTRADA');
  }
};

/**
 * Revoca una sesión; si era la de la cookie actual, limpia cookies HTTP.
 * @returns {{ cerroCookies: boolean }}
 */
exports.revocarSesionDispositivoYcookiesSiActual = async (pool, idRefresh, idUsuario, idEmpresa, rawRefreshActual, res) => {
  const prev = await sesionRefreshTokenRepository.obtenerActivoPorIdRefreshUsuario(
    pool,
    idRefresh,
    idUsuario,
    idEmpresa
  );
  const esCookieActual =
    Boolean(prev && rawRefreshActual && String(rawRefreshActual).length >= 32) &&
    hashToken(String(rawRefreshActual)) === prev.tokenHash;
  await exports.revocarSesionDispositivo(pool, idRefresh, idUsuario, idEmpresa);
  if (esCookieActual && res) {
    exports.limpiarCookies(res);
  }
  return { cerroCookies: Boolean(esCookieActual) };
};

exports.revocarOtrasSesionesDispositivos = async (pool, idUsuario, idEmpresa, rawRefreshActual) => {
  if (!rawRefreshActual || String(rawRefreshActual).length < 32) {
    throw new Error('REFRESH_NO_EN_COOKIES');
  }
  const h = hashToken(String(rawRefreshActual));
  await sesionRefreshTokenRepository.revocarActivosExceptoHash(pool, idUsuario, idEmpresa, h);
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
