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
    codigo: codigoInternoProducto(item),
    descripcion: String(item['descripcion'] ?? item['Descripcion'] ?? '').toLowerCase(),
    marca: marcaProductoEnLista(item).toLowerCase(),
    categoria: String(item['categoria'] ?? item['Categoria'] ?? '').toLowerCase()
  };
}

/** Código interno del catálogo (API puede mandar codigo o Codigo). */
export function codigoInternoProducto(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  return String(item['codigo'] ?? item['Codigo'] ?? '').trim().toLowerCase();
}

/** Código de barras / EAN del producto. */
export function codigoBarrasProducto(item: Record<string, unknown> | null | undefined): string {
  if (!item) return '';
  return String(
    item['codigoEan'] ?? item['CodigoEan'] ?? item['codigoEAN'] ?? item['ean'] ?? ''
  )
    .trim()
    .toLowerCase();
}

/**
 * Resuelve un producto por código interno, EAN o id.
 * En memoria conviene `soloExacto` para no tomar un prefijo y saltarse el API.
 */
export function resolverProductoPorCodigoEnLista(
  fuente: unknown[] | null | undefined,
  termino: string,
  opciones?: { soloExacto?: boolean; aceptarUnico?: boolean }
): Record<string, unknown> | null {
  const list = Array.isArray(fuente) ? fuente.filter(Boolean) : [];
  const raw = String(termino ?? '').trim();
  if (!raw || !list.length) {
    return null;
  }
  const term = raw.toLowerCase();
  const asRec = (item: unknown) => item as Record<string, unknown>;

  const porCodigo = list.find((item) => codigoInternoProducto(asRec(item)) === term);
  if (porCodigo) return asRec(porCodigo);

  const porEan = list.find((item) => codigoBarrasProducto(asRec(item)) === term);
  if (porEan) return asRec(porEan);

  const porId = list.find((item) => String(asRec(item)['idProducto'] ?? '').trim().toLowerCase() === term);
  if (porId) return asRec(porId);

  if (opciones?.soloExacto) {
    return null;
  }

  const incluye = list.find((item) => {
    const codigo = codigoInternoProducto(asRec(item));
    const ean = codigoBarrasProducto(asRec(item));
    return (codigo.length > 0 && codigo.includes(term)) || (ean.length > 0 && ean.includes(term));
  });
  if (incluye) return asRec(incluye);

  const prefijo = list.find((item) => codigoInternoProducto(asRec(item)).startsWith(term));
  if (prefijo) return asRec(prefijo);

  if (opciones?.aceptarUnico !== false && list.length === 1) {
    return asRec(list[0]);
  }
  return null;
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
  const ean = codigoBarrasProducto(item);
  return tokens.every(
    (tok) =>
      campos.codigo.includes(tok) ||
      ean.includes(tok) ||
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
