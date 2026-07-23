const { v4: uuidv4 } = require('uuid');
const cuentasBancariasRepository = require('../repositories/cuentasBancarias.repository');
const suscripcionRepository = require('../repositories/suscripcion.repository');

function idEmpresaDesdeUser(user) {
  const id = user?.empresa || user?.idEmpresa;
  if (!id) throw new Error('NO_AUTH');
  return String(id).trim();
}

function normalizarTexto(v, max) {
  const s = v == null ? '' : String(v).trim();
  if (!s) return '';
  return s.substring(0, max);
}

function normalizarCci(v) {
  const digitos = String(v == null ? '' : v).replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length > 20) throw new Error('CCI_INVALIDO');
  // En Perú el CCI tiene 20 dígitos; si envían algo, debe ser exactamente 20.
  if (digitos.length !== 20) throw new Error('CCI_INVALIDO');
  return digitos;
}

function validarPayload(body, { esCreacion }) {
  const nombreBanco = normalizarTexto(body?.nombreBanco, 100);
  const numeroCuenta = normalizarTexto(body?.numeroCuenta, 30);
  const cci = normalizarCci(body?.cci);
  const tipoCuenta = normalizarTexto(body?.tipoCuenta || 'AHORROS', 20).toUpperCase();
  const moneda = normalizarTexto(body?.moneda || 'PEN', 3).toUpperCase();
  const idCuentaContable = normalizarTexto(body?.idCuentaContable, 20) || null;
  const estado =
    body?.estado === false || body?.estado === 0 || body?.estado === '0' ? false : true;

  if (!nombreBanco) throw new Error('BANCO_REQUERIDO');
  if (!numeroCuenta) throw new Error('NUMERO_CUENTA_REQUERIDO');
  if (!tipoCuenta) throw new Error('TIPO_CUENTA_REQUERIDO');
  if (!moneda || moneda.length !== 3) throw new Error('MONEDA_INVALIDA');

  let fechaApertura = null;
  if (esCreacion) {
    const raw = (body?.fechaApertura || '').toString().trim();
    fechaApertura = raw ? new Date(raw) : new Date();
    if (Number.isNaN(fechaApertura.getTime())) throw new Error('FECHA_APERTURA_INVALIDA');
  }

  return {
    nombreBanco,
    numeroCuenta,
    cci,
    tipoCuenta,
    moneda,
    idCuentaContable,
    estado,
    fechaApertura,
    saldoActual: 0
  };
}

async function listar(pool, user) {
  const idEmpresa = idEmpresaDesdeUser(user);
  const rows = await cuentasBancariasRepository.listarPorEmpresa(pool, idEmpresa);
  let esEmpresaPrincipal = false;
  try {
    const idPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    esEmpresaPrincipal =
      !!idPrincipal && String(idPrincipal).toLowerCase() === String(idEmpresa).toLowerCase();
  } catch {
    esEmpresaPrincipal = false;
  }
  return { esEmpresaPrincipal, items: rows };
}

async function crear(pool, user, body) {
  const idEmpresa = idEmpresaDesdeUser(user);
  const datos = validarPayload(body || {}, { esCreacion: true });
  const idCuentaBancaria = uuidv4();
  await cuentasBancariasRepository.insertar(pool, {
    idCuentaBancaria,
    idEmpresa,
    ...datos
  });
  return cuentasBancariasRepository.obtenerPorId(pool, idEmpresa, idCuentaBancaria);
}

async function actualizar(pool, user, idCuentaBancaria, body) {
  const idEmpresa = idEmpresaDesdeUser(user);
  const id = (idCuentaBancaria || '').toString().trim();
  if (!id) throw new Error('ID_REQUERIDO');

  const actual = await cuentasBancariasRepository.obtenerPorId(pool, idEmpresa, id);
  if (!actual) throw new Error('NO_ENCONTRADO');

  const datos = validarPayload(body || {}, { esCreacion: false });
  const affected = await cuentasBancariasRepository.actualizar(pool, {
    idCuentaBancaria: id,
    idEmpresa,
    nombreBanco: datos.nombreBanco,
    numeroCuenta: datos.numeroCuenta,
    cci: datos.cci,
    tipoCuenta: datos.tipoCuenta,
    moneda: datos.moneda,
    estado: datos.estado,
    fechaCierre: datos.estado ? null : new Date(),
    idCuentaContable: datos.idCuentaContable
  });
  if (!affected) throw new Error('NO_ENCONTRADO');
  return cuentasBancariasRepository.obtenerPorId(pool, idEmpresa, id);
}

async function eliminar(pool, user, idCuentaBancaria) {
  const idEmpresa = idEmpresaDesdeUser(user);
  const id = (idCuentaBancaria || '').toString().trim();
  if (!id) throw new Error('ID_REQUERIDO');
  const actual = await cuentasBancariasRepository.obtenerPorId(pool, idEmpresa, id);
  if (!actual) throw new Error('NO_ENCONTRADO');
  const affected = await cuentasBancariasRepository.desactivar(pool, idEmpresa, id);
  if (!affected) throw new Error('NO_ENCONTRADO');
  return { idCuentaBancaria: id, estado: false };
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar
};
