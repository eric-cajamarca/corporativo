const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const saasPlanesService = require('./saasPlanes.service');
const { isSaas } = require('../config/deployment.config');

function idEmpresaDesdeUser(user) {
  if (!user) return null;
  const id = user.empresa || user.idEmpresa;
  if (!id) return null;
  const s = String(id).trim();
  return s || null;
}

function suscripcionVigenteParaDowngrade(sub) {
  if (!sub) return false;
  const st = String(sub.estado || '').toUpperCase();
  if (st !== 'ACTIVA' && st !== 'DEMO') return false;
  if (!sub.fechaFin) return st === 'ACTIVA';
  return new Date(sub.fechaFin) > new Date();
}

/**
 * Programa cambio a plan menor para la próxima renovación (sin cobro).
 */
async function programarDowngrade(pool, user, body) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error('NO_AUTH');

  const planCode = (body?.planCode || '').toString().trim().toLowerCase();
  let billingCycle = (body?.billingCycle || 'monthly').toString().trim().toLowerCase();
  if (billingCycle === 'anual') billingCycle = 'yearly';
  if (billingCycle === 'mensual') billingCycle = 'monthly';
  if (billingCycle !== 'monthly' && billingCycle !== 'yearly') {
    throw new Error('CICLO_FACTURACION_INVALIDO');
  }

  const plan = await saasPlanesService.resolverPlanInternoAsync(pool, planCode);
  if (!plan || plan.codigo === 'demo' || plan.codigo === 'enterprise') {
    throw new Error('PLAN_INVALIDO');
  }

  const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!suscripcionVigenteParaDowngrade(sub)) {
    throw new Error('DOWNGRADE_NO_APLICA');
  }

  const actual = String(sub.planCode || '').toLowerCase();
  if (actual === planCode) {
    throw new Error('MISMO_PLAN');
  }

  const esDown = await saasPlanesService.esDowngradePlanAsync(pool, actual, planCode);
  if (!esDown) {
    throw new Error('NO_ES_DOWNGRADE');
  }

  await empresaSuscripcionRepository.actualizarEstadoYPlan(pool, idEmpresa, {
    planCodePendiente: planCode,
    billingCyclePendiente: billingCycle
  });

  const planPendienteResumen = await saasPlanesService.obtenerResumenPlanAsync(pool, planCode);
  return {
    planCodeActual: actual,
    planCodePendiente: planCode,
    billingCyclePendiente: billingCycle,
    aplicaEn: sub.fechaFin || null,
    planPendiente: planPendienteResumen,
    mensaje:
      'El cambio a un plan menor se aplicará en su próxima renovación. No se realizará ningún cobro ahora.'
  };
}

async function cancelarDowngrade(pool, user) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const idEmpresa = idEmpresaDesdeUser(user);
  if (!idEmpresa) throw new Error('NO_AUTH');

  const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!sub) throw new Error('SIN_SUSCRIPCION');

  await empresaSuscripcionRepository.actualizarEstadoYPlan(pool, idEmpresa, {
    planCodePendiente: null,
    billingCyclePendiente: null
  });

  return { ok: true, message: 'Cambio de plan programado cancelado.' };
}

/**
 * true si iniciarCheckout debe rechazarse (downgrade con sub vigente).
 */
async function debeBloquearCheckoutPorDowngrade(pool, idEmpresa, planCodeDestino) {
  if (!idEmpresa) return false;
  const sub = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (!suscripcionVigenteParaDowngrade(sub)) return false;
  return saasPlanesService.esDowngradePlanAsync(pool, sub.planCode, planCodeDestino);
}

module.exports = {
  programarDowngrade,
  cancelarDowngrade,
  debeBloquearCheckoutPorDowngrade,
  suscripcionVigenteParaDowngrade
};
