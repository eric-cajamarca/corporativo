const { v4: uuidv4 } = require('uuid');
const { isSaas } = require('../config/deployment.config');
const { getPagoManualSuscripcionConfig } = require('../config/pagoManualSuscripcion.config');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const integracionesService = require('./integraciones.service');
const saasPlanesService = require('./saasPlanes.service');
const culqiChargeService = require('./culqiCharge.service');
const empresaSuscripcionBootstrap = require('./empresaSuscripcionBootstrap.service');

const MEDIOS_PAGO_MANUAL = new Set(['yape', 'plin', 'bcp']);
const ESTADO_PENDIENTE_VALIDACION = 'PENDIENTE_VALIDACION';

function construirOrderNumberCheckout() {
  return `CHK-${uuidv4()}`;
}

/**
 * Culqi suele exigir antifraud_details (sobre todo device_finger_print_id vía Culqi3DS) para reducir 3DS / denegaciones.
 */
function construirAntifraudDetailsCheckout(body, emailFallback) {
  const raw = body?.antifraud_details;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw;
  }
  const deviceId = (body?.deviceFingerPrintId || body?.device_finger_print_id || '').toString().trim();
  const email = (emailFallback || '').trim() || 'cliente@empresa.local';
  const localPart = email.split('@')[0] || 'cliente';
  const ant = {
    first_name: (body?.clientFirstName || localPart).toString().substring(0, 50),
    last_name: (body?.clientLastName || 'Suscripcion').toString().substring(0, 50),
    phone_number: (body?.clientPhone || '999999999').toString().substring(0, 20)
  };
  if (deviceId) {
    ant.device_finger_print_id = deviceId;
  }
  return ant;
}

function idEmpresaClienteDesdeSesion(authUser) {
  if (!authUser) return null;
  const id = authUser.empresa || authUser.idEmpresa;
  if (!id) return null;
  const s = String(id).trim();
  return s || null;
}

async function iniciarCheckout(pool, body, authUser) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const planCode = (body?.planCode || '').toString().toLowerCase();
  const billingCycle = (body?.billingCycle || 'monthly').toString().toLowerCase();
  const emailContacto = (body?.emailContacto || '').trim() || null;
  const idEmpresaCliente = idEmpresaClienteDesdeSesion(authUser);

  const plan = await saasPlanesService.resolverPlanInternoAsync(pool, planCode);
  if (!plan) throw new Error('PLAN_INVALIDO');

  if (planCode === 'demo') {
    const monto = 0;
    const idEmpresaPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
    if (!idEmpresaPrincipal) throw new Error('NO_PRINCIPAL');
    const orderNumber = construirOrderNumberCheckout();
    const idCheckout = uuidv4();
    await suscripcionCheckoutRepository.insertar(pool, {
      idCheckout,
      orderNumber,
      planCode,
      billingCycle: 'none',
      monto,
      moneda: 'PEN',
      estado: 'PENDIENTE',
      idEmpresaPrincipal,
      emailContacto,
      idEmpresaCliente
    });
    return {
      orderNumber,
      montoSoles: monto,
      montoCulqiCentimos: 0,
      planCode,
      billingCycle: 'none',
      culqiPublicKey: null,
      esDemo: true
    };
  }

  const montoSoles = await saasPlanesService.montoSolesAsync(pool, planCode, billingCycle);
  const montoCulqiCentimos = await saasPlanesService.montoCulqiCentimosAsync(pool, planCode, billingCycle);

  const idEmpresaPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
  if (!idEmpresaPrincipal) throw new Error('NO_PRINCIPAL');

  let culqiPublicKey = null;
  try {
    const credenciales = await integracionesService.obtenerCredencialesProveedor(pool, idEmpresaPrincipal, 'culqi');
    culqiPublicKey = credenciales.publicKey || credenciales.public_key || null;
  } catch (error) {
    console.error('iniciarCheckout: Culqi opcional no disponible:', error?.message || error);
  }

  const orderNumber = construirOrderNumberCheckout();
  const idCheckout = uuidv4();
  await suscripcionCheckoutRepository.insertar(pool, {
    idCheckout,
    orderNumber,
    planCode,
    billingCycle,
    monto: montoSoles,
    moneda: 'PEN',
    estado: 'PENDIENTE',
    idEmpresaPrincipal,
    emailContacto,
    idEmpresaCliente
  });

  return {
    orderNumber,
    montoSoles,
    montoCulqiCentimos,
    planCode,
    billingCycle,
    culqiPublicKey,
    culqiDisponible: Boolean(culqiPublicKey),
    esDemo: false,
    pagoManual: await getPagoManualSuscripcionConfig(pool)
  };
}

/**
 * Cliente reporta que pagó por Yape/Plin/BCP y enviará (o envió) el voucher por WhatsApp.
 * No marca PAGADO: queda en PENDIENTE_VALIDACION hasta confirmación del admin de plataforma.
 */
async function reportarPagoManual(pool, body, authUser) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const orderNumber = (body?.orderNumber || '').trim();
  const medio = (body?.medioPago || body?.medio || '').toString().trim().toLowerCase();
  const email = (body?.email || body?.emailContacto || '').trim();
  const referencia = (body?.referencia || '').toString().trim().substring(0, 60);

  if (!orderNumber) throw new Error('DATOS_INCOMPLETOS');
  if (!MEDIOS_PAGO_MANUAL.has(medio)) throw new Error('MEDIO_PAGO_INVALIDO');
  if (!email || email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('EMAIL_PAGO_INVALIDO');
  }

  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (row.planCode === 'demo') throw new Error('USAR_CONFIRMACION_DEMO');
  if (row.estado === 'PAGADO') {
    await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser);
    return {
      orderNumber,
      estado: row.estado,
      planCode: row.planCode,
      billingCycle: row.billingCycle,
      monto: row.monto,
      pagoManual: await getPagoManualSuscripcionConfig(pool)
    };
  }
  if (row.estado !== 'PENDIENTE' && row.estado !== ESTADO_PENDIENTE_VALIDACION) {
    throw new Error('CHECKOUT_NO_PERMITE_PAGO_MANUAL');
  }

  const idTx = `MANUAL-${medio.toUpperCase()}${referencia ? `:${referencia}` : ''}`;
  await suscripcionCheckoutRepository.actualizarEstadoPago(
    pool,
    orderNumber,
    ESTADO_PENDIENTE_VALIDACION,
    idTx.substring(0, 120)
  );
  if (email) {
    await suscripcionCheckoutRepository.actualizarEmailContacto(pool, orderNumber, email);
  }

  const final = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  return {
    orderNumber: final.orderNumber,
    estado: final.estado,
    planCode: final.planCode,
    billingCycle: final.billingCycle,
    monto: final.monto,
    medioPago: medio,
    pagoManual: await getPagoManualSuscripcionConfig(pool)
  };
}

async function confirmarDemoCheckout(pool, orderNumber, authUser) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row || row.planCode !== 'demo') throw new Error('CHECKOUT_INVALIDO');
  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'PAGADO', 'DEMO-SIN-PASARELA');
  const final = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser);
  return final;
}

async function confirmarCulqiCheckout(pool, body, authUser) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const orderNumber = (body?.orderNumber || '').trim();
  const tokenId = (body?.tokenId || '').trim();
  const email = (body?.email || '').trim();
  if (!orderNumber || !tokenId) throw new Error('DATOS_INCOMPLETOS');
  if (!email || email.length > 80 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('EMAIL_PAGO_INVALIDO');
  }

  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (row.estado === 'PAGADO') {
    await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser);
    return row;
  }
  if (row.planCode === 'demo') throw new Error('USAR_CONFIRMACION_DEMO');

  const idEmpresaPrincipal = row.idEmpresaPrincipal;
  const credenciales = await integracionesService.obtenerCredencialesProveedor(pool, idEmpresaPrincipal, 'culqi');
  const secretKey = credenciales.secretKey || credenciales.secret_key;
  if (!secretKey) throw new Error('CULQI_SECRET_FALTANTE');

  const amountCentimos = await saasPlanesService.montoCulqiCentimosAsync(pool, row.planCode, row.billingCycle);
  const expectedSoles = await saasPlanesService.montoSolesAsync(pool, row.planCode, row.billingCycle);
  if (Math.abs(Number(row.monto) - Number(expectedSoles)) > 0.009) {
    throw new Error('MONTO_CHECKOUT_INCONSISTENTE');
  }

  const antifraudDetails = construirAntifraudDetailsCheckout(body, email || row.emailContacto);
  const authentication3DS = body?.authentication3DS || body?.authentication_3DS;
  const authenticationPayload =
    authentication3DS && typeof authentication3DS === 'object' && !Array.isArray(authentication3DS)
      ? authentication3DS
      : undefined;

  const cargo = await culqiChargeService.crearCargo({
    secretKey,
    amountCentimos,
    email: email || row.emailContacto,
    tokenId,
    metadata: { order_number: orderNumber, planCode: row.planCode, billingCycle: row.billingCycle },
    antifraudDetails,
    authentication3DS: authenticationPayload
  });

  if (!cargo.ok) {
    if (cargo.code !== 'REQUIERE_3DS') {
      await suscripcionCheckoutRepository.actualizarEstadoPago(
        pool,
        orderNumber,
        'FALLIDO',
        String(cargo.message || '')
      );
    }
    if (cargo.code === 'REQUIERE_3DS') {
      const err = new Error('REQUIERE_3DS');
      err.actionCode = cargo.actionCode || null;
      throw err;
    }
    throw new Error(cargo.message || 'CULQI_RECHAZADO');
  }

  const idTx = cargo.data?.id ? String(cargo.data.id) : '';
  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'PAGADO', idTx);
  const final = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, orderNumber, authUser);
  return final;
}

async function estadoCheckout(pool, orderNumber) {
  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  return { estado: row.estado, planCode: row.planCode, billingCycle: row.billingCycle, monto: row.monto };
}

module.exports = {
  iniciarCheckout,
  confirmarDemoCheckout,
  confirmarCulqiCheckout,
  reportarPagoManual,
  estadoCheckout,
  ESTADO_PENDIENTE_VALIDACION
};
