/**
 * Alertas de uso de plan (aviso >= 80 %, crítico >= 100 %).
 */
function buildAlertaUso(clave, etiqueta, usado, maximo) {
  const max = Number(maximo);
  const u = Number(usado);
  if (!Number.isFinite(max) || max <= 0 || !Number.isFinite(u) || u < 0) return null;
  const porcentaje = Math.min(100, Math.round((100 * u) / max));
  if (u >= max) {
    return { clave, etiqueta, usado: u, maximo: max, porcentaje: 100, nivel: 'critico' };
  }
  if (u / max >= 0.8) {
    return { clave, etiqueta, usado: u, maximo: max, porcentaje, nivel: 'aviso' };
  }
  return null;
}

function construirAlertasPlan(uso) {
  const items = [
    buildAlertaUso('sunat', 'Comprobantes SUNAT', uso.comprobantesSunat, uso.maxComprobantesSunat),
    buildAlertaUso('usuarios', 'Usuarios', uso.usuariosOcupados, uso.maxUsuarios),
    buildAlertaUso('sucursales', 'Sucursales', uso.sucursales, uso.maxSucursales),
    buildAlertaUso('productos', 'Productos activos', uso.productosActivos, uso.maxProductos),
    buildAlertaUso(
      'bot_conversaciones',
      'Conversaciones bot simultáneas',
      uso.botConversacionesActivas,
      uso.maxBotConversaciones
    )
  ];
  return items.filter(Boolean);
}

module.exports = { buildAlertaUso, construirAlertasPlan };
