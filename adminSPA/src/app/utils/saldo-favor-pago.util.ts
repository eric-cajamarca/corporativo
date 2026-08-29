/**
 * Saldo a favor no es forma de pago del cajero: se aplica solo con el botón dedicado.
 * Se oculta del select de FormasPago / MediosPago en venta y cobranza.
 */

export function esDescripcionSaldoFavor(descripcion: string | null | undefined): boolean {
  const d = String(descripcion || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return d.includes('saldo a favor') || d === 'saf';
}

export function esCodigoMedioSaldoFavor(codigo: string | null | undefined): boolean {
  return String(codigo || '').trim().toUpperCase() === 'SAF';
}

export function esFormaOMedioSaldoFavor(item: {
  codigo?: string | null;
  descripcion?: string | null;
} | null | undefined): boolean {
  if (!item) return false;
  return esCodigoMedioSaldoFavor(item.codigo) || esDescripcionSaldoFavor(item.descripcion);
}

export function filtrarSinSaldoFavor<T extends { codigo?: string | null; descripcion?: string | null }>(
  items: T[] | null | undefined
): T[] {
  return (items || []).filter((x) => !esFormaOMedioSaldoFavor(x));
}
