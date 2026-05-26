// jwt.js
const jwt = require('jsonwebtoken');
const moment = require('moment');
const crypto = require('crypto');
const { getJwtSecret } = require('../config/jwt.config');

function derive2faKey() {
  return crypto.createHash('sha256').update('2fa_pending:' + getJwtSecret()).digest();
}

function encrypt2faPayload(plainObj) {
  const key = derive2faKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(plainObj), 'utf8'),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString('base64url');
}

function decrypt2faPayload(blob) {
  const key = derive2faKey();
  const buf = Buffer.from(blob, 'base64url');
  if (buf.length < 12 + 16 + 1) throw new Error('Payload 2FA inválido');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

const ACCESS_EXPIRES_MINUTES = Math.min(
  Math.max(parseInt(process.env.JWT_ACCESS_EXPIRES_MINUTES, 10) || 240, 5),
  24 * 60
);

exports.getAccessExpiresMinutes = () => ACCESS_EXPIRES_MINUTES;

/** Duración de la cookie de acceso en ms (alineada al JWT). */
exports.getAccessTokenMaxAgeMs = () => ACCESS_EXPIRES_MINUTES * 60 * 1000;

/** Token para recuperación de contraseña (válido 15 min) */
exports.createResetToken = function (payload) {
  return jwt.sign(
    { ...payload, purpose: 'password_reset', iat: moment().unix(), exp: moment().add(15, 'minutes').unix() },
    getJwtSecret()
  );
};

exports.verifyResetToken = function (token) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.purpose !== 'password_reset') throw new Error('Token inválido');
  return decoded;
};

const TWOFA_PENDING_MINUTES = Math.min(
  Math.max(parseInt(process.env.JWT_2FA_PENDING_MINUTES, 10) || 10, 3),
  30
);

/**
 * JWT de corta duración tras password OK; permite completar TOTP sin cookies
 * de sesión. El payload sensible (idUsuario, idEmpresa, synthetic, flow) viaja
 * cifrado con AES-256-GCM dentro del campo "data", de modo que un MITM o un
 * XSS no pueda inferir IDs reales con sólo decodificar el JWT en base64.
 */
exports.createTwoFactorPendingToken = function (payload) {
  const sealed = encrypt2faPayload({
    idUsuario: payload.idUsuario,
    idEmpresa: payload.idEmpresa,
    synthetic: !!payload.synthetic,
    flow: payload.flow
  });
  return jwt.sign(
    { purpose: '2fa_pending', data: sealed },
    getJwtSecret(),
    { expiresIn: `${TWOFA_PENDING_MINUTES}m` }
  );
};

exports.verifyTwoFactorPendingToken = function (token) {
  const decoded = jwt.verify(token, getJwtSecret());
  if (decoded.purpose !== '2fa_pending') throw new Error('Token 2FA inválido');

  let inner;
  if (decoded.data) {
    try {
      inner = decrypt2faPayload(decoded.data);
    } catch (err) {
      throw new Error('Token 2FA inválido');
    }
  } else if (decoded.idUsuario && decoded.idEmpresa) {
    inner = {
      idUsuario: decoded.idUsuario,
      idEmpresa: decoded.idEmpresa,
      synthetic: !!decoded.synthetic,
      flow: decoded.flow
    };
  } else {
    throw new Error('Token 2FA inválido');
  }

  if (inner.flow !== 'setup' && inner.flow !== 'verify') {
    throw new Error('Token 2FA inválido');
  }
  return {
    purpose: '2fa_pending',
    idUsuario: inner.idUsuario,
    idEmpresa: inner.idEmpresa,
    synthetic: !!inner.synthetic,
    flow: inner.flow,
    iat: decoded.iat,
    exp: decoded.exp
  };
};

/**
 * JWT de acceso. Solo claims minimos y no-PII: sub (idUsuario), empresa,
 * rol, sid (idRefresh). Los datos de perfil (nombres, apellidos, email,
 * razonSocial) viajan al frontend en la respuesta JSON del login y se
 * conservan en el state del cliente, NO en el token. Si algun consumidor
 * server-side necesita el email u otros campos, debe hacer SELECT sobre
 * UsuarioWeb usando req.user.sub + req.user.empresa.
 */
exports.createToken = function (user) {
  const payload = {
    empresa: user.idEmpresa,
    sub: user.idUsuario,
    rol: user.rol,
    iat: moment().unix(),
    exp: moment().add(ACCESS_EXPIRES_MINUTES, 'minutes').unix()
  };
  if (user.idRefresh) {
    payload.sid = String(user.idRefresh);
  }
  return jwt.sign(payload, getJwtSecret());
};