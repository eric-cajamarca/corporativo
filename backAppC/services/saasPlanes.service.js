/**
 * Catálogo comercial de planes (montos en PEN). Ajustar según mercado.
 */
const PLANES = {
  emprendedor: {
    codigo: 'emprendedor',
    nombre: 'Emprendedor',
    descripcionCorta: 'Compras, ventas e inventario para empezar.',
    mensualPen: 59,
    anualPen: 590,
    maxUsuarios: 4,
    maxSucursales: 1,
    beneficios: [
      'Hasta 4 usuarios y 1 sucursal',
      'Productos (categorías, marcas, impuestos), clientes y proveedores',
      'Compras, ventas e inventario con lotes',
      'Reportes esenciales de operación'
    ]
  },
  profesional: {
    codigo: 'profesional',
    nombre: 'Profesional',
    descripcionCorta: 'Caja, créditos, análisis y reportes.',
    mensualPen: 149,
    anualPen: 1490,
    maxUsuarios: 11,
    maxSucursales: 3,
    beneficios: [
      'Todo lo que tiene el plan emprendedor',
      'Hasta 11 usuarios y hasta 3 sucursales',
      'Caja, créditos y cuotas',
      'Análisis financiero y reportes avanzados',
      'Listas de precio y escenarios comerciales'
    ]
  },
  empresarial: {
    codigo: 'empresarial',
    nombre: 'Empresarial',
    descripcionCorta: 'Escala, sucursales y multi-empresa.',
    mensualPen: 399,
    anualPen: 3990,
    maxUsuarios: 35,
    maxSucursales: 99,
    beneficios: [
      'Todo lo que tiene el plan Profesional',
      'Hasta 35 usuarios y hasta 99 sucursales',
      'Multi-empresa y gestores (varias razones sociales)',
      'Prioridad de soporte y opciones de escala (según contrato)',
      'Integraciones y operación avanzada (según contrato)'
    ]
  },
  demo: {
    codigo: 'demo',
    nombre: 'Demo',
    descripcionCorta: 'Prueba el sistema 14 días.',
    mensualPen: 0,
    anualPen: 0,
    maxUsuarios: 3,
    maxSucursales: 1,
    beneficios: []
  }
};

/** Solo planes de pago para la página pública (sin card demo). El plan demo sigue disponible por checkout. */
function listarPlanesCatalogo() {
  return ['emprendedor', 'profesional', 'empresarial'].map((key) => {
    const p = PLANES[key];
    return {
      planCode: p.codigo,
      nombre: p.nombre,
      descripcionCorta: p.descripcionCorta,
      beneficios: Array.isArray(p.beneficios) ? p.beneficios : [],
      precioMensualPen: p.mensualPen,
      precioAnualPen: p.anualPen,
      maxUsuarios: p.maxUsuarios,
      maxSucursales: p.maxSucursales
    };
  });
}

function obtenerPlan(planCode) {
  const key = (planCode || '').toString().toLowerCase();
  return PLANES[key] || null;
}

function montoSoles(planCode, billingCycle) {
  const p = obtenerPlan(planCode);
  if (!p) throw new Error('PLAN_INVALIDO');
  if (p.codigo === 'demo') return 0;
  const c = (billingCycle || '').toString().toLowerCase();
  if (c === 'yearly' || c === 'anual') return p.anualPen;
  if (c === 'monthly' || c === 'mensual') return p.mensualPen;
  throw new Error('CICLO_FACTURACION_INVALIDO');
}

/** Culqi usa el monto en la unidad mínima (céntimos para PEN). */
function montoCulqiCentimos(planCode, billingCycle) {
  const soles = montoSoles(planCode, billingCycle);
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
  obtenerPlan,
  montoSoles,
  montoCulqiCentimos,
  fechaFinDesdePlan
};
