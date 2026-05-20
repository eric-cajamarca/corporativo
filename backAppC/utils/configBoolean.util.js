'use strict';

/**
 * @param {*} valor
 * @param {boolean} predeterminado
 * @returns {boolean}
 */
function interpretarBooleanoConfig(valor, predeterminado) {
  if (valor === undefined || valor === null) return predeterminado;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  const t = String(valor).trim().toLowerCase();
  if (t === '') return predeterminado;
  if (t === 'false' || t === '0' || t === 'no' || t === 'off') return false;
  if (t === 'true' || t === '1' || t === 'yes' || t === 'on') return true;
  return predeterminado;
}

/** Lee INVENTARIO_PERMITIR_VENTAS_NEGATIVAS desde getConfig(clave, def). */
function leerPermitirVentasNegativas(getConfig) {
  return interpretarBooleanoConfig(getConfig('INVENTARIO_PERMITIR_VENTAS_NEGATIVAS', 'false'), false);
}

/** getConfig(clave, def) a partir de filas ConfiguracionEmpresa. */
function crearLectorConfiguracionEmpresa(configRows) {
  const rows = Array.isArray(configRows) ? configRows : [];
  return (clave, def) => {
    const row = rows.find((c) => String(c.clave || '').trim() === String(clave).trim());
    return row != null && row.valor !== undefined && row.valor !== null ? row.valor : def;
  };
}

module.exports = {
  interpretarBooleanoConfig,
  leerPermitirVentasNegativas,
  crearLectorConfiguracionEmpresa
};
