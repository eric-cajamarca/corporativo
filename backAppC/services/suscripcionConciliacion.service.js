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
    await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, on, user);
    return row;
  }
  if (row.estado !== ESTADO_PENDIENTE_VALIDACION && row.estado !== 'PENDIENTE') {
    throw new Error('CHECKOUT_NO_PERMITE_CONFIRMAR');
  }

  const prevTx = (row.idTransaccionPasarela || '').toString().trim();
  const idTx = prevTx.startsWith('MANUAL-')
    ? `${prevTx}|ADMIN-OK`.substring(0, 120)
    : 'MANUAL-ADMIN-OK';

  await suscripcionCheckoutRepository.actualizarEstadoPago(pool, on, 'PAGADO', idTx);
  await empresaSuscripcionBootstrap.intentarAplicarPagoCheckoutAEmpresa(pool, on, user);
  return suscripcionCheckoutRepository.obtenerPorOrderNumber(pool, on);
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
  convertirCsv
};

