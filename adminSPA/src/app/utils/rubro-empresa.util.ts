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

/**
 * Rubro Botica / Farmacia: código de sistema FAR.
 * Si hay otro código de sistema no se infiere por el texto SUNAT.
 */
export function esRubroFarmacia(
  codigoRubro?: string | null,
  rubroTexto?: string | null
): boolean {
  const codigo = String(codigoRubro || '').trim().toUpperCase();
  if (codigo === 'FAR' || codigo === 'FARMACIA' || codigo === 'BOTICA') return true;
  if (codigo) return false;
  const rubro = String(rubroTexto || '').trim().toLowerCase();
  return /\b(farmacia|botica|droguer)/.test(rubro);
}
