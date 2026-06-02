/**
 * Mapeo entre códigos internos en Comprobantes (2 caracteres) y tipo SUNAT.
 * F7/B7 = Nota de Crédito (SUNAT 07); F8/B8 = Nota de Débito (SUNAT 08).
 */

/**
 * Tipo documento SUNAT para ComprobantesElectronicos y XML.
 * @param {string} codigo - codigo de fila Comprobantes
 * @returns {string}
 */
function tipoSunatDesdeCodigoComprobante(codigo) {
  const c = String(codigo || "").trim().toUpperCase();
  if (c === "F7" || c === "B7") return "07";
  if (c === "F8" || c === "B8") return "08";
  return c;
}

/**
 * @param {string} codigo
 * @returns {boolean}
 */
function esNotaCreditoCodigoComprobante(codigo) {
  const c = String(codigo || "").trim().toUpperCase();
  return c === "07" || c === "F7" || c === "B7";
}

/**
 * Código interno en Comprobantes para emitir NC según el tipo del comprobante origen (CE).
 * @param {string} ceTipoOrigen - '01' factura, '03' boleta
 * @returns {'F7'|'B7'}
 */
function codigoInternoNotaCreditoPorOrigen(ceTipoOrigen) {
  const t = String(ceTipoOrigen || "").trim();
  return t === "03" ? "B7" : "F7";
}

/**
 * Código interno para Nota de Débito según tipo del comprobante origen (CE).
 * @param {string} ceTipoOrigen - '01' factura, '03' boleta
 * @returns {'F8'|'B8'}
 */
function codigoInternoNotaDebitoPorOrigen(ceTipoOrigen) {
  const t = String(ceTipoOrigen || "").trim();
  return t === "03" ? "B8" : "F8";
}

/** Solo nota de crédito (no débito). */
function esSoloNotaCreditoCodigo(codigo) {
  const c = String(codigo || "").trim().toUpperCase();
  return c === "07" || c === "F7" || c === "B7";
}

module.exports = {
  tipoSunatDesdeCodigoComprobante,
  esNotaCreditoCodigoComprobante,
  esSoloNotaCreditoCodigo,
  codigoInternoNotaCreditoPorOrigen,
  codigoInternoNotaDebitoPorOrigen
};
