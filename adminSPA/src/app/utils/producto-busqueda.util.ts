/** Palabras del término de búsqueda (separadas por espacios). */
export function tokenizarTerminoBusquedaProducto(termino: string): string[] {
  const t = String(termino ?? '').trim().toLowerCase();
  if (!t) {
    return [];
  }
  return t.split(/\s+/).filter(Boolean);
}

/** Campos usados en el modal de búsqueda de productos (ventas, conteo físico en cliente). */
export function camposBusquedaProducto(item: Record<string, unknown> | null | undefined): {
  codigo: string;
  descripcion: string;
  marca: string;
  categoria: string;
} {
  if (!item) {
    return { codigo: '', descripcion: '', marca: '', categoria: '' };
  }
  return {
    codigo: String(item['codigo'] ?? '').toLowerCase(),
    descripcion: String(item['descripcion'] ?? '').toLowerCase(),
    marca: marcaProductoEnLista(item).toLowerCase(),
    categoria: String(item['categoria'] ?? '').toLowerCase()
  };
}

/**
 * Cada palabra del término debe aparecer en al menos uno de: código, descripción, marca o categoría.
 */
export function productoCoincideBusquedaMultipalabra(
  item: Record<string, unknown> | null | undefined,
  termino: string
): boolean {
  const tokens = tokenizarTerminoBusquedaProducto(termino);
  if (!tokens.length) {
    return true;
  }
  const campos = camposBusquedaProducto(item);
  return tokens.every(
    (tok) =>
      campos.codigo.includes(tok) ||
      campos.descripcion.includes(tok) ||
      campos.marca.includes(tok) ||
      campos.categoria.includes(tok)
  );
}

/** Texto de marca para listados / modales (API puede enviar marca, nombreMarca o nombre). */
export function marcaProductoEnLista(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  const v = item['marca'] ?? item['nombreMarca'] ?? item['nombreMarcaProducto'] ?? item['nombre'] ?? '';
  return String(v ?? '').trim();
}

/**
 * Modal de búsqueda de productos: resaltar solo cuando el stock numérico es exactamente 0.
 */
export function productoSinStockEnBusqueda(item: Record<string, unknown> | null | undefined): boolean {
  if (!item) return false;
  const raw = item['stock'];
  if (raw == null || raw === '') return false;
  const n = Number(raw);
  return Number.isFinite(n) && n === 0;
}

/**
 * Catálogo para ventas: solo productos con estado activo (bit en BD).
 * Si la API no envía `estado`, se considera activo por compatibilidad.
 */
export function productoActivoParaVenta(item: Record<string, unknown> | null | undefined): boolean {
  if (!item) return false;
  const e = item['estado'];
  if (e === undefined || e === null) return true;
  if (e === true || e === 1 || e === '1') return true;
  if (e === false || e === 0 || e === '0') return false;
  return true;
}
