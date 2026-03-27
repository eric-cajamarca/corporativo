// jwt.js
const jwt = require('jsonwebtoken');
const moment = require('moment');
const secret = process.env.JWT_SECRET || 'erik@./Eog_DEV_CHANGE_IN_PRODUCTION';

const ACCESS_EXPIRES_MINUTES = Math.min(
  Math.max(parseInt(process.env.JWT_ACCESS_EXPIRES_MINUTES, 10) || 15, 5),
  24 * 60
);

exports.getAccessExpiresMinutes = () => ACCESS_EXPIRES_MINUTES;

/** Duración de la cookie de acceso en ms (alineada al JWT). */
exports.getAccessTokenMaxAgeMs = () => ACCESS_EXPIRES_MINUTES * 60 * 1000;

/** Token para recuperación de contraseña (válido 15 min) */
exports.createResetToken = function (payload) {
  return jwt.sign(
    { ...payload, purpose: 'password_reset', iat: moment().unix(), exp: moment().add(15, 'minutes').unix() },
    secret
  );
};

exports.verifyResetToken = function (token) {
  const decoded = jwt.verify(token, secret);
  if (decoded.purpose !== 'password_reset') throw new Error('Token inválido');
  return decoded;
};

const TWOFA_PENDING_MINUTES = Math.min(
  Math.max(parseInt(process.env.JWT_2FA_PENDING_MINUTES, 10) || 10, 3),
  30
);

/** JWT de corta duración tras password OK; permite completar TOTP sin cookies de sesión. */
exports.createTwoFactorPendingToken = function (payload) {
  return jwt.sign(
    {
      purpose: '2fa_pending',
      idUsuario: payload.idUsuario,
      idEmpresa: payload.idEmpresa,
      synthetic: !!payload.synthetic,
      flow: payload.flow
    },
    secret,
    { expiresIn: `${TWOFA_PENDING_MINUTES}m` }
  );
};

exports.verifyTwoFactorPendingToken = function (token) {
  const decoded = jwt.verify(token, secret);
  if (decoded.purpose !== '2fa_pending') throw new Error('Token 2FA inválido');
  if (decoded.flow !== 'setup' && decoded.flow !== 'verify') throw new Error('Token 2FA inválido');
  return decoded;
};

exports.createToken = function (user) {
  const payload = {
    empresa: user.idEmpresa,
    sub: user.idUsuario,
    nombres: user.nombres,
    apellidos: user.apellidos,
    email: user.email,
    rol: user.rol,
    iat: moment().unix(),
    exp: moment().add(ACCESS_EXPIRES_MINUTES, 'minutes').unix()
  };
  return jwt.sign(payload, secret);
};