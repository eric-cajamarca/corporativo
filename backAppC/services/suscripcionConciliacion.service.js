const suscripcionCatalogoAdminService = require('./suscripcionCatalogoAdmin.service');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');
const empresaSuscripcionBootstrap = require('./empresaSuscripcionBootstrap.service');

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
    return suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
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
  return suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
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
  convertirCsv
};

