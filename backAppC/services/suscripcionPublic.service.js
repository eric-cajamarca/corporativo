const { v4: uuidv4 } = require('uuid');
const { isSaas } = require('../config/deployment.config');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const integracionesService = require('./integraciones.service');
const saasPlanesService = require('./saasPlanes.service');
const culqiChargeService = require('./culqiCharge.service');

function construirOrderNumberCheckout() {
  return `CHK-${uuidv4()}`;
}

async function iniciarCheckout(pool, body) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const planCode = (body?.planCode || '').toString().toLowerCase();
  const billingCycle = (body?.billingCycle || 'monthly').toString().toLowerCase();
  const emailContacto = (body?.emailContacto || '').trim() || null;

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
      emailContacto
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

  const credenciales = await integracionesService.obtenerCredencialesProveedor(pool, idEmpresaPrincipal, 'culqi');
  const culqiPublicKey = credenciales.publicKey || credenciales.public_key || null;
  if (!culqiPublicKey) throw new Error('CULQI_NO_CONFIGURADO');

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
    emailContacto
  });

  return {
    orderNumber,
    montoSoles,
    montoCulqiCentimos,
    planCode,
    billingCycle,
    culqiPublicKey,
    esDemo: false
  };
}

async function confirmarDemoCheckout(pool, orderNumber) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row || row.planCode !== 'demo') throw new Error('CHECKOUT_INVALIDO');
  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'PAGADO', 'DEMO-SIN-PASARELA');
  return suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
}

async function confirmarCulqiCheckout(pool, body) {
  if (!isSaas()) throw new Error('MODO_NO_SAAS');
  const orderNumber = (body?.orderNumber || '').trim();
  const tokenId = (body?.tokenId || '').trim();
  const email = (body?.email || '').trim();
  if (!orderNumber || !tokenId) throw new Error('DATOS_INCOMPLETOS');

  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (row.estado === 'PAGADO') return row;
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

  const cargo = await culqiChargeService.crearCargo({
    secretKey,
    amountCentimos,
    email: email || row.emailContacto,
    tokenId,
    metadata: { order_number: orderNumber, planCode: row.planCode, billingCycle: row.billingCycle }
  });

  if (!cargo.ok) {
    await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'FALLIDO', String(cargo.message || ''));
    throw new Error(cargo.message || 'CULQI_RECHAZADO');
  }

  const idTx = cargo.data?.id ? String(cargo.data.id) : '';
  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'PAGADO', idTx);
  return suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, orderNumber);
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
  estadoCheckout
};
