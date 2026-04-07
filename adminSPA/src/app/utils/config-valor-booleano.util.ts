/**
 * Interpreta valores de ConfiguracionEmpresa (string, number, boolean).
 * Evita que solo se compare con 'false' y queden activos '0', 0, etc.
 */
export function interpretarBooleanoConfig(valor: unknown, predeterminado: boolean): boolean {
  if (valor === undefined || valor === null) return predeterminado;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor !== 0;
  const t = String(valor).trim().toLowerCase();
  if (t === '') return predeterminado;
  if (t === 'false' || t === '0' || t === 'no' || t === 'off') return false;
  if (t === 'true' || t === '1' || t === 'yes' || t === 'on') return true;
  return predeterminado;
}
