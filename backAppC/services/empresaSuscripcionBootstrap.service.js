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
 * Inicio del nuevo período de vigencia.
 * Renovar el mismo plan antes del vencimiento no debe perder los días que aún
 * quedan: el mes o el año contratado se cuenta desde la fechaFin vigente.
 * Un cambio de plan sí entra en vigor de inmediato, así que parte de la fecha de pago.
 */
function baseNuevaVigencia(existente, planCodePagado, ahora) {
  if (!existente || !existente.fechaFin) return ahora;
  const actual = String(existente.planCode || '').trim().toLowerCase();
  const pagado = String(planCodePagado || '').trim().toLowerCase();
  if (!actual || actual !== pagado) return ahora;
  const fin = new Date(String(existente.fechaFin).replace(' ', 'T'));
  if (Number.isNaN(fin.getTime()) || fin <= ahora) return ahora;
  return fin;
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
  const ahora = new Date();
  const fechaFin = saasPlanesService.fechaFinDesdePlan(
    chk.planCode,
    chk.billingCycle,
    baseNuevaVigencia(existente, chk.planCode, ahora)
  );
  if (!existente) {
    await empresaSuscripcionRepository.insertar(pool, {
      idSuscripcion: uuidv4(),
      idEmpresa,
      planCode: chk.planCode,
      billingCycle: chk.billingCycle,
      estado: 'ACTIVA',
      fechaInicio: ahora,
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
      migracionDemoPendiente: false,
      planCodePendiente: null,
      billingCyclePendiente: null
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
 * Prioriza siempre idEmpresaCliente del checkout (empresa que pagó / vinculó).
 * El JWT solo se usa si el checkout aún no tiene empresa (p. ej. el propio cliente acaba de pagar con Culqi).
 * Importante: cuando confirma el admin de la empresa principal, idAuth ≠ idCliente y NO debe bloquear.
 */
async function intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser) {
  const chk = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!chk || String(chk.estado || '').toUpperCase() !== 'PAGADO') {
    return { aplicado: false, motivo: 'NO_PAGADO' };
  }

  const idChk = chk.idEmpresaCliente ? String(chk.idEmpresaCliente).trim() : null;
  const idAuth = idEmpresaDesdeJwt(authUser);

  // Empresa del checkout primero (cliente). Nunca usar la empresa del admin si el checkout ya tiene cliente.
  const idEmpresa = idChk || idAuth || null;
  if (!idEmpresa) {
    console.error(
      'contexto: intentarAplicarPagoCheckoutAEmpresa sin empresa destino (ordene sin vincular y sin sesión cliente)'
    );
    return { aplicado: false, motivo: 'SIN_EMPRESA' };
  }

  if (idChk && idAuth && idChk.toLowerCase() !== String(idAuth).toLowerCase()) {
    // Esperable al confirmar desde panel de plataforma: admin ≠ cliente. Aplicar al cliente.
    console.error(
      'contexto: intentarAplicarPagoCheckoutAEmpresa aplicando plan a empresa del checkout (admin distinto)'
    );
  }

  try {
    const sub = await vincularCheckoutPagado(pool, idEmpresa, orderNumber);
    return { aplicado: true, idEmpresa, planCode: sub?.planCode || chk.planCode, estado: sub?.estado };
  } catch (err) {
    console.error('contexto: intentarAplicarPagoCheckoutAEmpresa', err.message || err);
    return { aplicado: false, motivo: err.message || 'ERROR' };
  }
}

module.exports = {
  aplicarSuscripcionNuevaEmpresa,
  vincularCheckoutPagado,
  intentarAplicarPagoCheckoutAEmpresa
};
