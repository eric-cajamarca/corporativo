/**
 * Dirección del cliente para PDF de comprobantes (solo texto legible, sin ubigeo/códigos SUNAT).
 */

/** Solo dígitos / códigos cortos (ubigeo, id ubicación, cod local, etc.). */
function esFragmentoCodigoUbicacion(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return true;
  if (/^(?:PEN|PE)$/i.test(s)) return true;
  if (/^0+$/.test(s)) return true;
  if (/^\d{1,6}$/.test(s)) return true;
  return false;
}

/**
 * Quita al final ubigeo (6 dígitos), cod. local y similares que se hayan pegado al texto.
 * @param {string} texto
 * @returns {string}
 */
function limpiarCodigosSunatAlFinal(texto) {
  let s = String(texto ?? '').trim();
  if (!s) return '';
  let prev;
  do {
    prev = s;
    s = s
      .replace(/(?:,\s*)?\d{6}(?:\s*,\s*\d{1,6}){0,3}\s*$/g, '')
      .replace(/\s+\d{6}(?:\s+\d{1,4}){0,2}(?:\s+\d{1,2})?\s*$/g, '')
      .replace(/\s+(?:PEN|PE)\s*$/gi, '')
      .trim();
  } while (s !== prev);
  return s;
}

/**
 * Texto para el campo DIRECCIÓN del PDF a partir de una fila DireccionClientes o string ya armado.
 * @param {string|{ direccion?: string, urbanizacion?: string }} entrada
 * @returns {string}
 */
function direccionClienteLegiblePdf(entrada) {
  if (entrada != null && typeof entrada === 'object') {
    const partes = [];
    const calle = String(entrada.direccion ?? '').trim();
    if (calle) partes.push(calle);
    const urb = String(entrada.urbanizacion ?? '').trim();
    if (urb && !esFragmentoCodigoUbicacion(urb)) partes.push(urb);
    return limpiarCodigosSunatAlFinal(partes.join(', '));
  }
  return limpiarCodigosSunatAlFinal(String(entrada ?? ''));
}

module.exports = {
  direccionClienteLegiblePdf,
  limpiarCodigosSunatAlFinal,
  esFragmentoCodigoUbicacion
};
