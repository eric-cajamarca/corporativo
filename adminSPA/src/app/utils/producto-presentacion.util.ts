/**
 * Texto legible de unidad de medida / presentación para listados y modales de búsqueda.
 * Prioriza descripción (ej. "UNIDAD") sobre código SUNAT (ej. "NIU").
 */
export function descripcionUnidadMedidaProducto(
  p: Record<string, unknown> | null | undefined
): string {
  if (!p) {
    return '—';
  }
  const pres = p['presentacion'] as Record<string, unknown> | string | undefined;
  const desdePresentacion =
    pres && typeof pres === 'object'
      ? String(pres['descripcion'] ?? pres['Descripcion'] ?? '').trim()
      : typeof pres === 'string'
        ? pres.trim()
        : '';
  const desc = String(
    p['descripcionPres'] ??
      p['DescripcionPres'] ??
      desdePresentacion ??
      ''
  ).trim();
  if (desc) {
    return desc;
  }
  const codigo = String(p['codigoPresentacion'] ?? '').trim();
  return codigo || '—';
}

/** Descripción de producto para PDF/listados: «descripción - marca» si hay marca. */
export function descripcionProductoConMarca(
  descripcion?: string | null,
  marca?: string | null
): string {
  const base = String(descripcion ?? '').trim();
  const m = String(marca ?? '').trim();
  if (!m) {
    return base;
  }
  if (!base) {
    return m;
  }
  const baseLow = base.toLowerCase();
  const mLow = m.toLowerCase();
  if (baseLow.endsWith(` - ${mLow}`) || baseLow.endsWith(`-${mLow}`)) {
    return base;
  }
  return `${base} - ${m}`;
}
