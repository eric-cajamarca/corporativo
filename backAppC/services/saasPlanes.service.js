/**
 * Catálogo comercial de planes (montos en PEN, **sin IGV**). Ajustar según mercado.
 * Si existe la tabla SaasPlan (migración saas_planes_catalogo.sql), listados y montos pueden leerse desde BD.
 *
 * Catálogo público SaaS: básico, emprendedor, profesional.
 * demo: prueba 14 días. enterprise: on-prem / clientes grandes (sin checkout público).
 * empresarial: legado (suscriptores existentes); oculto del catálogo.
 */
const saasPlanRepository = require('../repositories/saasPlan.repository');

const PLANES = {
  demo: {
    codigo: 'demo',
    nombre: 'Demo',
    descripcionCorta: 'Prueba el sistema 14 días.',
    mensualPen: 0,
    anualPen: 0,
    maxUsuarios: 1,
    maxSucursales: 1,
    maxComprobantesSunatAceptados: 50,
    maxProductosActivos: 500,
    maxBotConversacionesSimultaneas: 0,
    beneficios: [
      '14 días sin costo',
      '1 usuario y 1 sucursal',
      'Operación comercial e inventario (con límites de demo)',
      'Hasta 50 comprobantes SUNAT aceptados'
    ]
  },
  basico: {
    codigo: 'basico',
    nombre: 'Básico',
    descripcionCorta: 'Todo el sistema para 1 local: facturación SUNAT, inventario y WhatsApp ilimitado.',
    mensualPen: 49,
    anualPen: 490,
    maxUsuarios: 2,
    maxSucursales: 1,
    maxComprobantesSunatAceptados: 200,
    maxProductosActivos: 2000,
    maxBotConversacionesSimultaneas: 0,
    beneficios: [
      'Todo el sistema: ventas, compras, inventario, caja, créditos y despachos',
      'Hasta 200 comprobantes SUNAT aceptados al mes',
      'Hasta 2 usuarios, 1 sucursal y 2 000 productos',
      'WhatsApp vinculado ilimitado (envío de comprobantes)',
      'Cotizaciones, compras y clientes sin límite',
      'Sin bot de pedidos WhatsApp'
    ]
  },
  emprendedor: {
    codigo: 'emprendedor',
    nombre: 'Emprendedor',
    descripcionCorta: 'Escala tu PYME: más volumen SUNAT, equipo y bot de pedidos WhatsApp.',
    mensualPen: 89,
    anualPen: 890,
    maxUsuarios: 6,
    maxSucursales: 3,
    maxComprobantesSunatAceptados: 800,
    maxProductosActivos: 4000,
    maxBotConversacionesSimultaneas: 5,
    beneficios: [
      'Todo lo del plan Básico con más capacidad',
      'Hasta 800 comprobantes SUNAT aceptados al mes',
      'Hasta 6 usuarios, 3 sucursales y 4 000 productos',
      'WhatsApp ilimitado + bot de pedidos',
      'Hasta 5 conversaciones bot simultáneas',
      'Cotizaciones, compras y clientes sin límite'
    ]
  },
  profesional: {
    codigo: 'profesional',
    nombre: 'Profesional',
    descripcionCorta: 'Alto volumen: varias sucursales, catálogo grande y bot con más concurrencia.',
    mensualPen: 169,
    anualPen: 1690,
    maxUsuarios: 20,
    maxSucursales: 8,
    maxComprobantesSunatAceptados: 3000,
    maxProductosActivos: 8000,
    maxBotConversacionesSimultaneas: 20,
    beneficios: [
      'Todo lo del plan Emprendedor para operación exigente',
      'Hasta 3 000 comprobantes SUNAT aceptados al mes',
      'Hasta 20 usuarios, 8 sucursales y 8 000 productos',
      'WhatsApp ilimitado + bot de pedidos',
      'Hasta 20 conversaciones bot simultáneas',
      'Soporte prioritario'
    ]
  },
  empresarial: {
    codigo: 'empresarial',
    nombre: 'Empresarial (legado)',
    descripcionCorta: 'Plan anterior; contacte soporte para migrar a Profesional.',
    mensualPen: 399,
    anualPen: 3990,
    maxUsuarios: 35,
    maxSucursales: 99,
    maxComprobantesSunatAceptados: 10000,
    beneficios: []
  },
  enterprise: {
    codigo: 'enterprise',
    nombre: 'Enterprise',
    descripcionCorta: 'Licencia on-premise / servidor propio. Gestores multi-empresa (desde S/ 350/mes, cotización).',
    mensualPen: 0,
    anualPen: 0,
    maxUsuarios: 99999,
    maxSucursales: 99999,
    maxComprobantesSunatAceptados: 0,
    beneficios: [
      'Despliegue en servidores del cliente o dedicados',
      'Multi-empresa con gestores (varias razones sociales)',
      'Sin límite de comprobantes SUNAT en catálogo',
      'Soporte e implementación según contrato'
    ]
  }
};

/** Planes de pago visibles en /public/planes (sin demo ni enterprise). */
function listarPlanesCatalogo() {
  return ['basico', 'emprendedor', 'profesional'].map((key) => {
    const p = PLANES[key];
    return {
      planCode: p.codigo,
      nombre: p.nombre,
      descripcionCorta: p.descripcionCorta,
      beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
      precioMensualPen: p.mensualPen,
      precioAnualPen: p.anualPen,
      maxUsuarios: p.maxUsuarios,
      maxSucursales: p.maxSucursales,
      maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0,
      maxProductosActivos: p.maxProductosActivos ?? 0,
      maxBotConversacionesSimultaneas: p.maxBotConversacionesSimultaneas ?? 0
    };
  });
}

function obtenerPlan(planCode) {
  const key = (planCode || '').toString().toLowerCase();
  return PLANES[key] || null;
}

function parseBeneficiosJson(raw) {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function filaBdAPlanInterno(row) {
  if (!row) return null;
  return {
    codigo: row.planCode,
    nombre: row.nombre,
    descripcionCorta: row.descripcionCorta,
    mensualPen: Number(row.precioMensualPen),
    anualPen: Number(row.precioAnualPen),
    maxUsuarios: Number(row.maxUsuarios),
    maxSucursales: Number(row.maxSucursales),
    maxComprobantesSunatAceptados: Number(row.maxComprobantesSunatAceptados ?? 0),
    maxProductosActivos: Number(row.maxProductosActivos ?? 0),
    maxBotConversacionesSimultaneas: Number(row.maxBotConversacionesSimultaneas ?? 0),
    beneficios: parseBeneficiosJson(row.beneficiosJson)
  };
}

function filaBdACatalogoItem(row) {
  const p = filaBdAPlanInterno(row);
  if (!p) return null;
  return {
    planCode: p.codigo,
    nombre: p.nombre,
    descripcionCorta: p.descripcionCorta,
    beneficios: p.beneficios,
    precioMensualPen: p.mensualPen,
    precioAnualPen: p.anualPen,
    maxUsuarios: p.maxUsuarios,
    maxSucursales: p.maxSucursales,
    maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0,
    maxProductosActivos: p.maxProductosActivos ?? 0,
    maxBotConversacionesSimultaneas: p.maxBotConversacionesSimultaneas ?? 0
  };
}

/** Listado para /public/planes: usa SaasPlan si hay filas; si no, catálogo en memoria. */
async function listarPlanesCatalogoAsync(pool) {
  const rows = await saasPlanRepository.listarCatalogoPublico(pool);
  if (rows.length) {
    return rows.map(filaBdACatalogoItem).filter(Boolean);
  }
  return listarPlanesCatalogo();
}

/** Resumen del plan actual (mi-estado). */
async function obtenerResumenPlanAsync(pool, planCode) {
  const row = await saasPlanRepository.obtenerPorPlanCode(pool, planCode);
  if (row) return filaBdACatalogoItem(row);
  const p = obtenerPlan(planCode);
  if (!p) return null;
  return {
    planCode: p.codigo,
    nombre: p.nombre,
    descripcionCorta: p.descripcionCorta,
    beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
    precioMensualPen: p.mensualPen,
    precioAnualPen: p.anualPen,
    maxUsuarios: p.maxUsuarios,
    maxSucursales: p.maxSucursales,
    maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0,
    maxProductosActivos: p.maxProductosActivos ?? 0,
    maxBotConversacionesSimultaneas: p.maxBotConversacionesSimultaneas ?? 0
  };
}

async function resolverPlanInternoAsync(pool, planCode) {
  const row = await saasPlanRepository.obtenerPorPlanCode(pool, planCode);
  if (row) return filaBdAPlanInterno(row);
  return obtenerPlan(planCode);
}

function montoSolesDesdePlanInterno(p, billingCycle) {
  if (!p) throw new Error('PLAN_INVALIDO');
  if (p.codigo === 'demo') return 0;
  const c = (billingCycle || '').toString().toLowerCase();
  if (c === 'yearly' || c === 'anual') return p.anualPen;
  if (c === 'monthly' || c === 'mensual') return p.mensualPen;
  throw new Error('CICLO_FACTURACION_INVALIDO');
}

function montoSoles(planCode, billingCycle) {
  const p = obtenerPlan(planCode);
  return montoSolesDesdePlanInterno(p, billingCycle);
}

async function montoSolesAsync(pool, planCode, billingCycle) {
  const p = await resolverPlanInternoAsync(pool, planCode);
  return montoSolesDesdePlanInterno(p, billingCycle);
}

/** Culqi usa el monto en la unidad mínima (céntimos para PEN). */
function montoCulqiCentimos(planCode, billingCycle) {
  const soles = montoSoles(planCode, billingCycle);
  return Math.round(Number(soles) * 100);
}

async function montoCulqiCentimosAsync(pool, planCode, billingCycle) {
  const soles = await montoSolesAsync(pool, planCode, billingCycle);
  return Math.round(Number(soles) * 100);
}

function fechaFinDesdePlan(planCode, billingCycle, desde) {
  const base = desde ? new Date(desde) : new Date();
  if (planCode === 'demo') {
    const d = new Date(base);
    d.setDate(d.getDate() + 14);
    return d;
  }
  const c = (billingCycle || '').toLowerCase();
  const d = new Date(base);
  if (c === 'yearly' || c === 'anual') {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  d.setMonth(d.getMonth() + 1);
  return d;
}

/** Fallback si SaasPlan no tiene fila (mismo orden que migraciones catálogo). */
const ORDEN_PLAN_FALLBACK = {
  enterprise: 0,
  demo: 5,
  basico: 15,
  emprendedor: 20,
  profesional: 30,
  empresarial: 90,
  pendiente: 0
};

async function obtenerOrdenPlanAsync(pool, planCode) {
  const key = (planCode || '').toString().trim().toLowerCase();
  if (!key) return 0;
  const row = await saasPlanRepository.obtenerPorPlanCode(pool, key);
  if (row && row.orden != null && Number.isFinite(Number(row.orden))) {
    return Number(row.orden);
  }
  return ORDEN_PLAN_FALLBACK[key] != null ? ORDEN_PLAN_FALLBACK[key] : 0;
}

/**
 * true si destino es plan menor (orden estricto) respecto al actual.
 * Mismo planCode no es downgrade (renovación / mismo plan).
 */
async function esDowngradePlanAsync(pool, planCodeActual, planCodeDestino) {
  const a = (planCodeActual || '').toString().trim().toLowerCase();
  const b = (planCodeDestino || '').toString().trim().toLowerCase();
  if (!a || !b || a === b) return false;
  const ordenA = await obtenerOrdenPlanAsync(pool, a);
  const ordenB = await obtenerOrdenPlanAsync(pool, b);
  return ordenB < ordenA;
}

module.exports = {
  listarPlanesCatalogo,
  listarPlanesCatalogoAsync,
  obtenerPlan,
  obtenerResumenPlanAsync,
  resolverPlanInternoAsync,
  montoSoles,
  montoSolesAsync,
  montoCulqiCentimos,
  montoCulqiCentimosAsync,
  fechaFinDesdePlan,
  obtenerOrdenPlanAsync,
  esDowngradePlanAsync,
  ORDEN_PLAN_FALLBACK
};
