const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const usuarioRepository = require('../repositories/usuario.repository');
const empresaRepository = require('../repositories/empresa.repository');

const ROLES_2FA = ['Administrador', 'superAdmin'];

exports.requiere2faRolElevado = (rol) => ROLES_2FA.includes(rol);

function esEnabled(v) {
  return v === true || v === 1;
}

exports.obtenerEstado = async (pool, idUsuario, idEmpresa, syntheticFlag) => {
  if (syntheticFlag) {
    const row = await empresaRepository.obtenerTotpEmpresa(pool, idEmpresa);
    if (!row) return { secret: null, enabled: false };
    return {
      secret: row.totpSecret || null,
      enabled: esEnabled(row.totpEnabled)
    };
  }
  const row = await usuarioRepository.obtenerTotpUsuario(pool, idUsuario, idEmpresa);
  if (!row) return { secret: null, enabled: false };
  return {
    secret: row.totpSecret || null,
    enabled: esEnabled(row.totpEnabled)
  };
};

async function obtenerEmailEtiqueta(pool, decoded) {
  if (decoded.synthetic) {
    const emp = await empresaRepository.obtenerBasicaPorId(pool, decoded.idEmpresa);
    return emp && emp.correo ? String(emp.correo).slice(0, 120) : 'admin';
  }
  const uw = await usuarioRepository.buscarPorIdYEmpresa(pool, decoded.idUsuario, decoded.idEmpresa);
  return uw && uw.email ? String(uw.email).slice(0, 120) : 'usuario';
}

async function issuerNombre(pool, idEmpresa) {
  const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
  if (emp && emp.razon_Social) return String(emp.razon_Social).slice(0, 40);
  return 'CRM';
}

async function persistSecret(pool, decoded, secret, enabled) {
  if (decoded.synthetic) {
    await empresaRepository.actualizarTotpEmpresa(pool, decoded.idEmpresa, secret, enabled);
  } else {
    await usuarioRepository.actualizarTotpUsuario(pool, decoded.idUsuario, decoded.idEmpresa, secret, enabled);
  }
}

exports.iniciarSetup = async (pool, decoded) => {
  if (decoded.flow !== 'setup') throw new Error('2FA_FLUJO_INVALIDO');
  const st = await exports.obtenerEstado(pool, decoded.idUsuario, decoded.idEmpresa, decoded.synthetic);
  if (st.enabled) throw new Error('2FA_YA_ACTIVO');

  let secret = st.secret;
  if (!secret) {
    secret = authenticator.generateSecret();
    await persistSecret(pool, decoded, secret, false);
  }

  const emailLabel = await obtenerEmailEtiqueta(pool, decoded);
  const issuer = await issuerNombre(pool, decoded.idEmpresa);
  const otpauth = authenticator.keyuri(emailLabel, issuer, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth, { errorCorrectionLevel: 'M', margin: 2, width: 220 });
  return { qrDataUrl };
};

exports.completarSetup = async (pool, decoded, code) => {
  if (decoded.flow !== 'setup') throw new Error('2FA_FLUJO_INVALIDO');
  const st = await exports.obtenerEstado(pool, decoded.idUsuario, decoded.idEmpresa, decoded.synthetic);
  if (st.enabled) throw new Error('2FA_YA_ACTIVO');
  if (!st.secret) throw new Error('2FA_SIN_SECRETO');
  const token = String(code || '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(token)) throw new Error('CODIGO_2FA_INCORRECTO');
  const ok = authenticator.verify({ token, secret: st.secret });
  if (!ok) throw new Error('CODIGO_2FA_INCORRECTO');
  await persistSecret(pool, decoded, st.secret, true);
};

exports.verificarCodigoLogin = async (pool, decoded, code) => {
  if (decoded.flow !== 'verify') throw new Error('2FA_FLUJO_INVALIDO');
  const st = await exports.obtenerEstado(pool, decoded.idUsuario, decoded.idEmpresa, decoded.synthetic);
  if (!st.enabled || !st.secret) throw new Error('2FA_NO_CONFIGURADO');
  const token = String(code || '').replace(/\s/g, '');
  if (!/^\d{6,8}$/.test(token)) throw new Error('CODIGO_2FA_INCORRECTO');
  const ok = authenticator.verify({ token, secret: st.secret });
  if (!ok) throw new Error('CODIGO_2FA_INCORRECTO');
};

/**
 * Restablece 2FA TOTP para una empresa: usuarios Administrador/superAdmin + fila Empresas (acceso por correo empresa).
 */
exports.resetearTotpEmpresa = async (pool, idEmpresa) => {
  const emp = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
  if (!emp) throw new Error('EMPRESA_NO_ENCONTRADA');
  await usuarioRepository.limpiarTotpRolesElevadosPorEmpresa(pool, idEmpresa);
  await empresaRepository.limpiarTotpEmpresaPorId(pool, idEmpresa);
};
