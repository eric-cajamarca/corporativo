/**
 * Validaciones Código producto SUNAT (Catálogo 25 / anexos 25.1–25.3).
 * Alineado a ERR-3496: 8 dígitos, no 00000000/99999999.
 */

const CODIGOS_RESERVADOS = new Set(['00000000', '99999999']);

function normalizarCodigoProductoSunat(valor) {
  if (valor == null) return null;
  const s = String(valor).trim();
  if (!s) return null;
  return s;
}

function esFormatoCodigoProductoSunatValido(codigo) {
  const c = normalizarCodigoProductoSunat(codigo);
  if (!c) return false;
  if (!/^\d{8}$/.test(c)) return false;
  if (CODIGOS_RESERVADOS.has(c)) return false;
  return true;
}

function validarCodigoProductoSunatOpcional(valor) {
  const c = normalizarCodigoProductoSunat(valor);
  if (c == null) return { ok: true, codigo: null };
  if (!esFormatoCodigoProductoSunatValido(c)) {
    return {
      ok: false,
      codigo: null,
      message:
        'El Código producto de SUNAT no es válido: debe ser numérico de 8 dígitos y distinto de 00000000 o 99999999.'
    };
  }
  return { ok: true, codigo: c };
}

function etiquetaAnexo(anexo) {
  switch (String(anexo || '').trim()) {
    case '25.1':
      return 'Bienes/servicios regulados';
    case '25.2':
      return 'Bien sujeto a detracción';
    case '25.3':
      return 'Bien sujeto a percepción';
    default:
      return 'Catálogo SUNAT';
  }
}

function normalizarTextoBusqueda(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensBusqueda(texto) {
  const stop = new Set([
    'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'en', 'para', 'con', 'sin',
    'un', 'una', 'unos', 'unas', 'por', 'al', 'a', 'the', 'of', 'or', 'and'
  ]);
  return normalizarTextoBusqueda(texto)
    .split(' ')
    .filter((t) => t.length >= 3 && !stop.has(t));
}

module.exports = {
  CODIGOS_RESERVADOS,
  normalizarCodigoProductoSunat,
  esFormatoCodigoProductoSunatValido,
  validarCodigoProductoSunatOpcional,
  etiquetaAnexo,
  normalizarTextoBusqueda,
  tokensBusqueda
};
