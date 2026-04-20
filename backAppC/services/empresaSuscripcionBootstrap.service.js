const { v4: uuidv4 } = require('uuid');
const { isEnterprise, isSaas } = require('../config/deployment.config');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const saasPlanesService = require('./saasPlanes.service');

/**
 * Tras crear empresa: fila de suscripción según modo y opciones de registro.
 */
async function aplicarSuscripcionNuevaEmpresa(pool, idEmpresa, options) {
  const solicitudDemo = !!options?.solicitudDemo;
  const checkoutOrderNumber = (options?.checkoutOrderNumber || '').trim() || null;

  if (isEnterprise()) {
    const existente = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
    if (existente) return existente;
    const idSuscripcion = uuidv4();
    await empresaSuscripcionRepository.insertar(pool, {
      idSuscripcion,
      idEmpresa,
      planCode: 'enterprise',
      billingCycle: null,
      estado: 'ENTERPRISE',
      fechaInicio: new Date(),
      fechaFin: null,
      idCheckoutOrigen: null,
      migracionDemoPendiente: false
    });
    return empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  }

  if (!isSaas()) {
    return null;
  }

  const existente = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  if (existente) return existente;

  if (checkoutOrderNumber) {
    const chk = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, checkoutOrderNumber);
    if (chk && chk.estado === 'PAGADO') {
      await suscripcionCheckoutRepository.vincularEmpresaCliente(pool, checkoutOrderNumber, idEmpresa);
      const idSuscripcion = uuidv4();
      const fechaFin = saasPlanesService.fechaFinDesdePlan(chk.planCode, chk.billingCycle, new Date());
      await empresaSuscripcionRepository.insertar(pool, {
        idSuscripcion,
        idEmpresa,
        planCode: chk.planCode,
        billingCycle: chk.billingCycle,
        estado: 'ACTIVA',
        fechaInicio: new Date(),
        fechaFin,
        idCheckoutOrigen: chk.idCheckout,
        migracionDemoPendiente: false
      });
      return empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
    }
  }

  if (solicitudDemo) {
    const idSuscripcion = uuidv4();
    const fechaFin = saasPlanesService.fechaFinDesdePlan('demo', 'none', new Date());
    await empresaSuscripcionRepository.insertar(pool, {
      idSuscripcion,
      idEmpresa,
      planCode: 'demo',
      billingCycle: null,
      estado: 'DEMO',
      fechaInicio: new Date(),
      fechaFin,
      idCheckoutOrigen: null,
      migracionDemoPendiente: false
    });
    return empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  }

  const idSuscripcion = uuidv4();
  await empresaSuscripcionRepository.insertar(pool, {
    idSuscripcion,
    idEmpresa,
    planCode: 'pendiente',
    billingCycle: null,
    estado: 'PENDIENTE_PAGO',
    fechaInicio: new Date(),
    fechaFin: null,
    idCheckoutOrigen: null,
    migracionDemoPendiente: false
  });
  return empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
}

/**
 * Vincula un pago Culqi ya confirmado (checkout PAGADO) con la empresa del usuario logueado.
 */
async function vincularCheckoutPagado(pool, idEmpresa, orderNumber) {
  const chk = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!chk) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (chk.estado !== 'PAGADO') throw new Error('CHECKOUT_NO_PAGADO');
  if (chk.idEmpresaCliente && String(chk.idEmpresaCliente).toLowerCase() !== String(idEmpresa).toLowerCase()) {
    throw new Error('CHECKOUT_YA_VINCULADO');
  }

  await suscripcionCheckoutRepository.vincularEmpresaCliente(pool, orderNumber, idEmpresa);

  const existente = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
  const fechaFin = saasPlanesService.fechaFinDesdePlan(chk.planCode, chk.billingCycle, new Date());
  if (!existente) {
    await empresaSuscripcionRepository.insertar(pool, {
      idSuscripcion: uuidv4(),
      idEmpresa,
      planCode: chk.planCode,
      billingCycle: chk.billingCycle,
      estado: 'ACTIVA',
      fechaInicio: new Date(),
      fechaFin,
      idCheckoutOrigen: chk.idCheckout,
      migracionDemoPendiente: false
    });
  } else {
    await empresaSuscripcionRepository.actualizarEstadoYPlan(pool, idEmpresa, {
      planCode: chk.planCode,
      billingCycle: chk.billingCycle,
      estado: 'ACTIVA',
      fechaFin,
      idCheckoutOrigen: chk.idCheckout,
      migracionDemoPendiente: false
    });
  }
  return empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);
}

function idEmpresaDesdeJwt(authUser) {
  if (!authUser) return null;
  const id = authUser.empresa || authUser.idEmpresa;
  if (!id) return null;
  const s = String(id).trim();
  return s || null;
}

/**
 * Tras marcar un checkout CHK-* como PAGADO: actualiza EmpresaSuscripcion sin intervención del cliente.
 * Usa idEmpresaCliente del checkout (sesión al iniciar o webhook) o, si coincide, la empresa del JWT.
 */
async function intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser) {
  const chk = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!chk || String(chk.estado || '').toUpperCase() !== 'PAGADO') {
    return;
  }
  const idChk = chk.idEmpresaCliente ? String(chk.idEmpresaCliente).trim() : null;
  const idAuth = idEmpresaDesdeJwt(authUser);
  if (idChk && idAuth && idChk.toLowerCase() !== String(idAuth).toLowerCase()) {
    console.error('contexto: intentarAplicarPagoCheckoutAEmpresa empresa checkout distinta a sesión, omitido');
    return;
  }
  const idEmpresa = idChk || idAuth || null;
  if (!idEmpresa) {
    return;
  }
  try {
    await vincularCheckoutPagado(pool, idEmpresa, orderNumber);
  } catch (err) {
    console.error('contexto: intentarAplicarPagoCheckoutAEmpresa', err.message || err);
  }
}

module.exports = {
  aplicarSuscripcionNuevaEmpresa,
  vincularCheckoutPagado,
  intentarAplicarPagoCheckoutAEmpresa
};
