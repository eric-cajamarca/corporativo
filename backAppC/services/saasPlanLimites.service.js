const { getDeploymentMode } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');
const saasPlanesService = require('./saasPlanes.service');
const saasContadorComprobantesSunatService = require('./saasContadorComprobantesSunat.service');

function suscripcionAplicaLimites(row) {
  if (!row) return false;
  const st = String(row.estado || '')
    .trim()
    .toUpperCase();
  return st === 'ACTIVA' || st === 'DEMO';
}

/**
 * SaaS con suscripción ACTIVA/DEMO: aplica topes del plan.
 * Otros modos o estados: sin enforcement aquí.
 */
async function debeAplicarLimitesPlan(pool, idEmpresa) {
  if (getDeploymentMode() !== 'saas' || !idEmpresa) return false;
  const row = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  return suscripcionAplicaLimites(row);
}

/**
 * Banderas y conteos para UI y permisos (null si no aplica).
 */
async function obtenerBanderasPlan(pool, idEmpresa) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) {
    return null;
  }
  const subRow = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  const planCode = String((subRow && subRow.planCode) || 'demo')
    .trim()
    .toLowerCase();
  const resumen = await saasPlanesService.obtenerResumenPlanAsync(pool, planCode);
  if (!resumen) return null;

  const maxU = Number(resumen.maxUsuarios);
  const maxS = Number(resumen.maxSucursales);
  const maxCompSunat = Number(resumen.maxComprobantesSunatAceptados);
  const uso = await empresaSuscripcionUsoRepository.contarUso(pool, idEmpresa);
  const totU = uso.usuariosPlazas;
  const totS = uso.sucursales;
  const totD = uso.direccionesEmpresa;

  const limUsu = maxU > 0;
  const limSuc = maxS > 0;
  const limDir = maxS > 0;
  const limCompSunat = Number.isFinite(maxCompSunat) && maxCompSunat > 0;

  const compU = await saasContadorComprobantesSunatService.obtenerUsadosComprobantesSunatEfectivo(pool, idEmpresa);

  return {
    planCode,
    maxUsuarios: maxU,
    maxSucursales: maxS,
    maxDireccionesEmpresa: maxS,
    maxComprobantesSunatAceptados: maxCompSunat,
    comprobantesSunatAceptados: compU,
    usuariosActivos: uso.usuariosActivos,
    usuariosOcupados: totU,
    sucursales: totS,
    direccionesEmpresa: totD,
    puedeCrearUsuario: !limUsu || totU < maxU,
    puedeCrearSucursal: !limSuc || totS < maxS,
    puedeAgregarDireccionEmpresa: !limDir || totD < maxS,
    puedeCrearVentaPorCuotaSunat: !limCompSunat || compU < maxCompSunat,
    excedeUsuarios: limUsu && totU > maxU,
    excedeSucursales: limSuc && totS > maxS,
    excedeDirecciones: limDir && totD > maxS,
    excedeComprobantesSunat: limCompSunat && compU >= maxCompSunat
  };
}

async function assertPuedeCrearUsuarioColaborador(pool, idEmpresa) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const b = await obtenerBanderasPlan(pool, idEmpresa);
  if (!b || b.puedeCrearUsuario) return;
  throw new Error('PLAN_LIMITE_USUARIOS');
}

async function assertPuedeCrearSucursal(pool, idEmpresa) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const b = await obtenerBanderasPlan(pool, idEmpresa);
  if (!b || b.puedeCrearSucursal) return;
  throw new Error('PLAN_LIMITE_SUCURSALES');
}

/**
 * Alta de dirección de empresa (+ opcional sucursal vinculada).
 */
async function assertPuedeAgregarDireccionEmpresa(pool, idEmpresa, opts) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const crearSucursal = !!(opts && opts.crearSucursal);
  const b = await obtenerBanderasPlan(pool, idEmpresa);
  if (!b) return;
  if (!b.puedeAgregarDireccionEmpresa) {
    throw new Error('PLAN_LIMITE_DIRECCIONES_EMPRESA');
  }
  if (crearSucursal && !b.puedeCrearSucursal) {
    throw new Error('PLAN_LIMITE_SUCURSALES');
  }
}

/**
 * SaaS ACTIVA/DEMO: bloquea creación de ventas (factura/boleta desde POS) si se alcanzó el tope de comprobantes SUNAT aceptados del plan.
 */
async function assertPuedeCrearVenta(pool, idEmpresa) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const row = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!row) return;
  const planCode = String(row.planCode || 'demo')
    .trim()
    .toLowerCase();
  const resumen = await saasPlanesService.obtenerResumenPlanAsync(pool, planCode);
  if (!resumen) return;
  const maxC = Number(resumen.maxComprobantesSunatAceptados);
  if (!Number.isFinite(maxC) || maxC <= 0) return;
  const u = await saasContadorComprobantesSunatService.obtenerUsadosComprobantesSunatEfectivo(pool, idEmpresa);
  if (u >= maxC) {
    throw new Error('PLAN_LIMITE_COMPROBANTES_SUNAT');
  }
}

module.exports = {
  debeAplicarLimitesPlan,
  obtenerBanderasPlan,
  assertPuedeCrearUsuarioColaborador,
  assertPuedeCrearSucursal,
  assertPuedeAgregarDireccionEmpresa,
  assertPuedeCrearVenta
};
