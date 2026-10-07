export function cantidadEnUnidadCompra(
  item: {
    cantidad?: number;
    factorAInterna?: number | null;
    factorCompraAInterna?: number | null;
  },
  cantidadOverride?: number
): number {
  const cant = cantidadOverride != null ? Number(cantidadOverride) : Number(item?.cantidad) || 0;
  const fV = Number(item?.factorAInterna);
  const fC = Number(item?.factorCompraAInterna);
  if (!Number.isFinite(cant) || cant <= 0) return 0;
  if (!Number.isFinite(fV) || !Number.isFinite(fC) || fV <= 0 || fC <= 0) {
    return cant;
  }
  return Math.round((cant * (fV / fC)) * 1e6) / 1e6;
}

export function tieneUnidadesVenta(producto: {
  unidadesVenta?: Array<unknown> | null;
}): boolean {
  return Array.isArray(producto?.unidadesVenta) && producto.unidadesVenta.length > 0;
}

export function etiquetaUnidadCarrito(item: {
  nombreUnidadVenta?: string;
  codigoPresentacion?: string;
  presentacion?: string;
}): string {
  return String(item?.nombreUnidadVenta || item?.codigoPresentacion || item?.presentacion || '—');
}

export function redondearPrecio2(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

/**
 * Precio de una unidad de venta.
 * Si la unidad tiene precio propio (ej. 1/4 a 12.50), se usa ese.
 * Si no, se prorratea el precio del envase.
 */
export function precioUnidadDesdePrincipal(
  unidad: { precio?: number | null; factorAInterna?: number | null },
  precioPrincipal: number,
  factorCompraAInterna: number
): number {
  const guardado = Number(unidad?.precio);
  if (Number.isFinite(guardado) && guardado > 0) {
    return redondearPrecio2(guardado);
  }
  const base = Number(precioPrincipal) || 0;
  const fC = Number(factorCompraAInterna);
  const fV = Number(unidad?.factorAInterna);
  if (base > 0 && Number.isFinite(fC) && fC > 0 && Number.isFinite(fV) && fV > 0) {
    return redondearPrecio2(base * (fV / fC));
  }
  return 0;
}

/** Precio de lista comparable a pVenta de la línea (misma unidad, no el envase completo). */
export function precioListaMismaUnidad(
  item: {
    precioListaUnidad?: number | null;
    factorAInterna?: number | null;
    factorCompraAInterna?: number | null;
    idUnidadVenta?: string | null;
    unidadesVenta?: Array<{
      idUnidadVenta?: string;
      precio?: number | null;
      factorAInterna?: number | null;
    }> | null;
  },
  precioPrincipalEnvase: number
): number {
  const fijo = Number(item?.precioListaUnidad);
  if (Number.isFinite(fijo) && fijo > 0) {
    return redondearPrecio2(fijo);
  }
  const fC = Number(item?.factorCompraAInterna);
  const fV = Number(item?.factorAInterna);
  if (!Number.isFinite(fV) || fV <= 0 || !Number.isFinite(fC) || fC <= 0) {
    return redondearPrecio2(precioPrincipalEnvase);
  }
  const unidad = Array.isArray(item?.unidadesVenta)
    ? item.unidadesVenta.find((u) => String(u.idUnidadVenta) === String(item.idUnidadVenta || ''))
    : undefined;
  return precioUnidadDesdePrincipal(
    { precio: unidad?.precio, factorAInterna: fV },
    precioPrincipalEnvase,
    fC
  );
}

export function stockAlcanzaEnUnidad(
  stockCompra: number,
  factorAInterna: number,
  factorCompraAInterna: number
): number {
  const fV = Number(factorAInterna);
  const fC = Number(factorCompraAInterna);
  const stock = Number(stockCompra);
  if (!Number.isFinite(stock) || stock <= 0 || !Number.isFinite(fV) || !Number.isFinite(fC) || fV <= 0 || fC <= 0) {
    return 0;
  }
  return Math.floor((stock * fC) / fV + 1e-9);
}
