const { getDeploymentMode } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const empresaSuscripcionUsoRepository = require('../repositories/empresaSuscripcionUso.repository');
const saasPlanesService = require('./saasPlanes.service');
const saasContadorComprobantesSunatService = require('./saasContadorComprobantesSunat.service');
const whatsappBotConversacionRepository = require('../repositories/whatsappBotConversacion.repository');
const { construirAlertasPlan } = require('../utils/saasPlanAlertas.util');

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

function banderasDesdeResumen(resumen, uso, compU, botActivas) {
  const maxU = Number(resumen.maxUsuarios);
  const maxS = Number(resumen.maxSucursales);
  const maxCompSunat = Number(resumen.maxComprobantesSunatAceptados);
  const maxProd = Number(resumen.maxProductosActivos);
  const maxBot = Number(resumen.maxBotConversacionesSimultaneas);
  const totU = uso.usuariosPlazas;
  const totS = uso.sucursales;
  const totD = uso.direccionesEmpresa;
  const prod = Number(uso.productosActivos) || 0;
  const botN = Number(botActivas) || 0;

  const limUsu = maxU > 0;
  const limSuc = maxS > 0;
  const limDir = maxS > 0;
  const limCompSunat = Number.isFinite(maxCompSunat) && maxCompSunat > 0;
  const limProd = Number.isFinite(maxProd) && maxProd > 0;
  const limBot = Number.isFinite(maxBot) && maxBot > 0;

  const alertasPlan = construirAlertasPlan({
    comprobantesSunat: compU,
    maxComprobantesSunat: maxCompSunat,
    usuariosOcupados: totU,
    maxUsuarios: maxU,
    sucursales: totS,
    maxSucursales: maxS,
    productosActivos: prod,
    maxProductos: maxProd,
    botConversacionesActivas: botN,
    maxBotConversaciones: maxBot
  });

  return {
    planCode: resumen.planCode,
    maxUsuarios: maxU,
    maxSucursales: maxS,
    maxDireccionesEmpresa: maxS,
    maxComprobantesSunatAceptados: maxCompSunat,
    maxProductosActivos: maxProd,
    maxBotConversacionesSimultaneas: maxBot,
    comprobantesSunatAceptados: compU,
    usuariosActivos: uso.usuariosActivos,
    usuariosOcupados: totU,
    sucursales: totS,
    direccionesEmpresa: totD,
    productosActivos: prod,
    botConversacionesActivas: botN,
    puedeCrearUsuario: !limUsu || totU < maxU,
    puedeCrearSucursal: !limSuc || totS < maxS,
    puedeAgregarDireccionEmpresa: !limDir || totD < maxS,
    puedeCrearProducto: !limProd || prod < maxProd,
    puedeCrearVentaPorCuotaSunat: !limCompSunat || compU < maxCompSunat,
    puedeAbrirConversacionBot: !limBot || botN < maxBot,
    excedeUsuarios: limUsu && totU >= maxU,
    excedeSucursales: limSuc && totS >= maxS,
    excedeDirecciones: limDir && totD >= maxS,
    excedeComprobantesSunat: limCompSunat && compU >= maxCompSunat,
    excedeProductos: limProd && prod >= maxProd,
    excedeBotConversaciones: limBot && botN >= maxBot,
    alertasPlan
  };
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

  const uso = await empresaSuscripcionUsoRepository.contarUso(pool, idEmpresa);
  const compU = await saasContadorComprobantesSunatService.obtenerUsadosComprobantesSunatEfectivo(
    pool,
    idEmpresa
  );
  let botActivas = 0;
  try {
    botActivas = await whatsappBotConversacionRepository.contarActivas(pool, idEmpresa);
  } catch (_) {
    botActivas = 0;
  }

  return banderasDesdeResumen({ ...resumen, planCode }, uso, compU, botActivas);
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

async function assertPuedeCrearProducto(pool, idEmpresa) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const b = await obtenerBanderasPlan(pool, idEmpresa);
  if (!b || b.puedeCrearProducto) return;
  throw new Error('PLAN_LIMITE_PRODUCTOS');
}

/**
 * Nueva sesión bot (teléfono sin conversación activa).
 */
async function assertPuedeAbrirConversacionBot(pool, idEmpresa, telefonoCliente) {
  if (!(await debeAplicarLimitesPlan(pool, idEmpresa))) return;
  const b = await obtenerBanderasPlan(pool, idEmpresa);
  if (!b) return;
  const maxBot = Number(b.maxBotConversacionesSimultaneas);
  if (!Number.isFinite(maxBot) || maxBot <= 0) {
    throw new Error('PLAN_BOT_NO_DISPONIBLE');
  }
  if (telefonoCliente) {
    const existente = await whatsappBotConversacionRepository.obtener(
      pool,
      idEmpresa,
      telefonoCliente
    );
    if (existente) return;
  }
  if (!b.puedeAbrirConversacionBot) {
    throw new Error('PLAN_LIMITE_BOT_CONVERSACIONES');
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
  assertPuedeCrearProducto,
  assertPuedeAbrirConversacionBot,
  assertPuedeCrearVenta
};
