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
