const { v4: uuidv4 } = require('uuid');
const suscripcionCatalogoAdminService = require('./suscripcionCatalogoAdmin.service');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const empresaSuscripcionBootstrap = require('./empresaSuscripcionBootstrap.service');
const suscripcionAvisosService = require('./suscripcionAvisos.service');
const seguridadAlertasService = require('./seguridadAlertas.service');
const empresaRepository = require('../repositories/empresa.repository');
const empresaSuscripcionRepository = require('../repositories/empresaSuscripcion.repository');
const suscripcionRepository = require('../repositories/suscripcion.repository');
const saasPlanesService = require('./saasPlanes.service');

/** Debe caber en SuscripcionCheckoutPendiente.estado VARCHAR(20). */
const ESTADO_PENDIENTE_VALIDACION = 'PENDIENTE_VALIDACION';

function escaparCsv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function listarConciliacion(pool, user, filtros) {
  const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
  if (!autorizado) throw new Error('NO_AUTORIZADO_CONCILIACION');
  return suscripcionCheckoutRepository.listarConciliacionCulqi(pool, filtros || {});
}

/** Órdenes en espera de voucher (pago manual Yape/Plin/BCP). */
async function listarPagosManualesPendientes(pool, user, filtros = {}) {
  const tieneEstado = Object.prototype.hasOwnProperty.call(filtros || {}, 'estado');
  const estado = tieneEstado
    ? filtros.estado || null
    : ESTADO_PENDIENTE_VALIDACION;
  return listarConciliacion(pool, user, {
    ...filtros,
    estado
  });
}

/**
 * Aviso de pago confirmado al cliente (WhatsApp + correo) sin bloquear la
 * respuesta al admin; el servicio de avisos nunca lanza.
 */
function avisarPagoConfirmado(pool, fila) {
  const idEmpresa = fila && fila.idEmpresaCliente ? String(fila.idEmpresaCliente).trim() : '';
  if (!idEmpresa) return;
  seguridadAlertasService.runSafeAlert(
    () =>
      suscripcionAvisosService.notificarPagoConfirmado(pool, {
        idEmpresa,
        orderNumber: fila.orderNumber,
        planCode: fila.planCode,
        billingCycle: fila.billingCycle,
        monto: fila.monto,
        moneda: fila.moneda,
        emailContacto: fila.emailContacto
      }),
    'suscripcion_pago_confirmado'
  );
}

/**
 * Admin de plataforma confirma voucher recibido por WhatsApp → PAGADO + aplica plan.
 */
async function confirmarPagoManualAdmin(pool, user, orderNumber) {
  const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
  if (!autorizado) throw new Error('NO_AUTORIZADO_CONCILIACION');

  const on = (orderNumber || '').trim();
  if (!on) throw new Error('DATOS_INCOMPLETOS');

  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (row.planCode === 'demo') throw new Error('USAR_CONFIRMACION_DEMO');
  if (row.estado === 'PAGADO') {
    const resultado = await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, on, user);
    if (resultado && resultado.aplicado === false && resultado.motivo === 'SIN_EMPRESA') {
      throw new Error('CHECKOUT_SIN_EMPRESA');
    }
    const filaReaplicada = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
    avisarPagoConfirmado(pool, filaReaplicada);
    return filaReaplicada;
  }
  if (row.estado !== ESTADO_PENDIENTE_VALIDACION && row.estado !== 'PENDIENTE') {
    throw new Error('CHECKOUT_NO_PERMITE_CONFIRMAR');
  }

  const prevTx = (row.idTransaccionPasarela || '').toString().trim();
  const idTx = prevTx.startsWith('MANUAL-')
    ? `${prevTx}|ADMIN-OK`.substring(0, 120)
    : 'MANUAL-ADMIN-OK';

  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, on, 'PAGADO', idTx);
  const resultado = await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, on, user);
  if (resultado && resultado.aplicado === false && resultado.motivo === 'SIN_EMPRESA') {
    // Queda PAGADO; el admin puede vincular después o el cliente crear empresa
    console.error('contexto: confirmarPagoManualAdmin PAGADO pero sin empresa vinculada', on);
  }
  const filaFinal = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
  avisarPagoConfirmado(pool, filaFinal);
  return filaFinal;
}

/**
 * Admin elimina/anula solicitud abandonada o fallida.
 * No elimina órdenes PAGADO. Primero intenta DELETE; si falla, marca ANULADO.
 */
async function eliminarSolicitudPagoManualAdmin(pool, user, orderNumber) {
  const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
  if (!autorizado) throw new Error('NO_AUTORIZADO_CONCILIACION');

  const on = (orderNumber || '').trim();
  if (!on) throw new Error('DATOS_INCOMPLETOS');

  const row = await suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
  if (!row) throw new Error('CHECKOUT_NO_ENCONTRADO');
  if (String(row.planCode || '').toLowerCase() === 'demo') throw new Error('NO_ELIMINAR_DEMO');
  if (String(row.estado || '').toUpperCase() === 'PAGADO') {
    throw new Error('NO_ELIMINAR_PAGADO');
  }
  if (String(row.estado || '').toUpperCase() === 'ANULADO') {
    return { orderNumber: on, eliminado: true, modo: 'ya_anulada' };
  }

  try {
    const deleted = await suscripcionCheckoutRepository.eliminarPorOrderNumber(pool, on);
    if (deleted > 0) {
      return { orderNumber: on, eliminado: true, modo: 'borrado' };
    }
  } catch (errDel) {
    console.error('eliminarSolicitudPagoManualAdmin DELETE:', errDel?.message || errDel);
  }

  const anuladas = await suscripcionCheckoutRepository.anularPorOrderNumber(pool, on);
  if (!anuladas) throw new Error('CHECKOUT_NO_ENCONTRADO');
  return { orderNumber: on, eliminado: true, modo: 'anulado' };
}

/**
 * Super Admin / Empresa Principal renueva o extiende directamente el plan de una empresa
 * tras recibir el voucher por WhatsApp, Yape, Plin o banco.
 */
async function renovarPlanEmpresaAdmin(pool, user, payload) {
  const autorizado = await suscripcionCatalogoAdminService.puedeEditarCatalogoPlanes(pool, user);
  if (!autorizado) throw new Error('NO_AUTORIZADO_CONCILIACION');

  const idEmpresa = (payload?.idEmpresa || '').trim();
  if (!idEmpresa) throw new Error('DATOS_INCOMPLETOS');

  const empresa = await empresaRepository.obtenerBasicaPorId(pool, idEmpresa);
  if (!empresa) throw new Error('EMPRESA_NO_ENCONTRADA');

  const suscripcionActual = await empresaSuscripcionRepository.obtenerPorEmpresa(pool, idEmpresa);

  let planCode = (payload?.planCode || '').trim().toLowerCase();
  if (!planCode || planCode === 'demo' || planCode === 'pendiente') {
    const act = (suscripcionActual?.planCode || '').trim().toLowerCase();
    planCode = act && act !== 'demo' && act !== 'pendiente' ? act : 'basico';
  }

  let billingCycle = (payload?.billingCycle || '').trim().toLowerCase();
  if (billingCycle !== 'yearly' && billingCycle !== 'monthly') {
    const actCiclo = (suscripcionActual?.billingCycle || '').trim().toLowerCase();
    billingCycle = actCiclo === 'yearly' ? 'yearly' : 'monthly';
  }

  let monto = Number(payload?.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    monto = await saasPlanesService.montoSolesAsync(pool, planCode, billingCycle);
  }

  const medioPago = String(payload?.medioPago || 'YAPE').trim().toUpperCase();
  const referencia = String(payload?.referencia || '').trim();

  const idEmpresaPrincipal = await suscripcionRepository.obtenerIdEmpresaPrincipal(pool);
  if (!idEmpresaPrincipal) throw new Error('NO_PRINCIPAL');

  const idCheckout = uuidv4();
  const orderNumber = `CHK-${uuidv4()}`;

  await suscripcionCheckoutRepository.insertar(pool, {
    idCheckout,
    orderNumber,
    planCode,
    billingCycle,
    monto,
    moneda: 'PEN',
    estado: 'PENDIENTE',
    idEmpresaPrincipal,
    emailContacto: empresa.correo || null,
    idEmpresaCliente: idEmpresa
  });

  const idTransaccion = (`MANUAL-ADMIN-${medioPago}${referencia ? `-${referencia}` : ''}`).substring(0, 120);
  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, orderNumber, 'PAGADO', idTransaccion);

  const subActualizada = await empresaSuscripcionBootstrap.vincularCheckoutPagado(pool, idEmpresa, orderNumber);

  // Si la empresa estaba inactiva (desactivada por vencimiento), reactivarla
  try {
    await empresaRepository.activarEmpresaSiInactiva(pool, idEmpresa);
  } catch (errAct) {
    console.error('contexto: activarEmpresaSiInactiva en renovarPlanEmpresaAdmin', errAct);
  }

  if (payload?.notificarCliente !== false) {
    avisarPagoConfirmado(pool, {
      orderNumber,
      planCode,
      billingCycle,
      idEmpresaCliente: idEmpresa,
      monto
    });
  }

  return {
    orderNumber,
    idEmpresa,
    planCode,
    billingCycle,
    monto,
    fechaFin: subActualizada?.fechaFin,
    estado: subActualizada?.estado || 'ACTIVA',
    empresaNombre: empresa.razon_Social
  };
}

function convertirCsv(rows) {
  const headers = [
    'orderNumber',
    'planCode',
    'billingCycle',
    'monto',
    'moneda',
    'estado',
    'idTransaccionPasarela',
    'fCreacion',
    'fConfirmacion',
    'emailContacto',
    'idEmpresaCliente',
    'razonSocialCliente',
    'rucCliente'
  ];
  const lines = [headers.join(',')];
  for (const row of rows || []) {
    lines.push(
      headers.map((h) => escaparCsv(row[h])).join(',')
    );
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  listarConciliacion,
  listarPagosManualesPendientes,
  confirmarPagoManualAdmin,
  eliminarSolicitudPagoManualAdmin,
  renovarPlanEmpresaAdmin,
  convertirCsv
};

