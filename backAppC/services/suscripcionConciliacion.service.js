const suscripcionCatalogoAdminService = require('./suscripcionCatalogoAdmin.service');
const suscripcionCheckoutRepository = require('../repositories/suscripcionCheckout.repository');

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
  convertirCsv
};

