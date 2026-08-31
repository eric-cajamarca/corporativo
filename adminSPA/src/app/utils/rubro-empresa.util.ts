/**
 * Rubro Pintura: código de sistema PINT (también PINTURA / PINTURAS).
 * Si hay otro código de sistema (GEN, GRF, HOTEL, …) no se infiere por el texto SUNAT.
 */
export function esRubroPintura(
  codigoRubro?: string | null,
  rubroTexto?: string | null
): boolean {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  if (codigo === 'PINT' || codigo === 'PINTURA' || codigo === 'PINTURAS') return true;
  if (codigo) return false;
  const rubro = String(rubroTexto || '').trim().toLowerCase();
  return /\bpintur/.test(rubro);
}
