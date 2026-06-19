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
    descripcionCorta: 'Operación esencial: ventas, compras e inventario con FE.',
    mensualPen: 49,
    anualPen: 490,
    maxUsuarios: 2,
    maxSucursales: 1,
    maxComprobantesSunatAceptados: 150,
    beneficios: [
      'Hasta 2 usuarios y 1 sucursal',
      'Ventas, compras, inventario, productos y clientes',
      'Cotizaciones comerciales',
      'Facturación electrónica SUNAT',
      'Hasta 150 comprobantes SUNAT aceptados',
      'Sin WhatsApp vinculado, caja ni créditos'
    ]
  },
  emprendedor: {
    codigo: 'emprendedor',
    nombre: 'Emprendedor',
    descripcionCorta: 'Caja, créditos, WhatsApp y operación completa para PYME.',
    mensualPen: 89,
    anualPen: 890,
    maxUsuarios: 4,
    maxSucursales: 1,
    maxComprobantesSunatAceptados: 500,
    beneficios: [
      'Todo lo del plan Básico',
      'Hasta 4 usuarios y 1 sucursal',
      'WhatsApp vinculado: envío de comprobantes y bot de atención',
      'Caja, créditos y catálogos',
      'Compras SUNAT (comprobantes de proveedor)',
      'Hasta 500 comprobantes SUNAT aceptados'
    ]
  },
  profesional: {
    codigo: 'profesional',
    nombre: 'Profesional',
    descripcionCorta: 'Despachos, reportes, análisis y escala comercial.',
    mensualPen: 169,
    anualPen: 1690,
    maxUsuarios: 11,
    maxSucursales: 3,
    maxComprobantesSunatAceptados: 2000,
    beneficios: [
      'Todo lo del plan Emprendedor',
      'Hasta 11 usuarios y 3 sucursales',
      'WhatsApp vinculado y bot con límites ampliados',
      'Despachos, análisis financiero y reportes',
      'Consultas placa/SOAT y utilidades de margen',
      'Hasta 2 000 comprobantes SUNAT aceptados'
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
      maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0
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
    maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0
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
    maxComprobantesSunatAceptados: p.maxComprobantesSunatAceptados ?? 0
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
  fechaFinDesdePlan
};
