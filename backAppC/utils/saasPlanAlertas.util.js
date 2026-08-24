/**
 * Alertas de uso de plan. Solo comprobantes SUNAT (aviso >= 90 %, crítico >= 100 %).
 * El resto de límites no genera avisos para no saturar la UI.
 */
function buildAlertaUso(clave, etiqueta, usado, maximo, umbralAviso = 0.9) {
  const max = Number(maximo);
  const u = Number(usado);
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(u) || u < 0) return null;
  const porcentaje = Math.min(100, Math.round((100 * u) / max));
  if (u >= max) {
    return { clave, etiqueta, usado: u, maximo: max, porcentaje: 100, nivel: 'critico' };
  }
  if (u / max >= umbralAviso) {
    return { clave, etiqueta, usado: u, maximo: max, porcentaje, nivel: 'aviso' };
  }
  return null;
}

function construirAlertasPlan(uso) {
  const items = [
    buildAlertaUso('sunat', 'Comprobantes SUNAT', uso.comprobantesSunat, uso.maxComprobantesSunat, 0.9)
  ];
  return items.filter(Boolean);
}

module.exports = { buildAlertaUso, construirAlertasPlan };
