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

/** Precio de una unidad: prorrateo del precio del envase (lista). Si no hay lista, usa el guardado. */
export function precioUnidadDesdePrincipal(
  unidad: { precio?: number | null; factorAInterna?: number | null },
  precioPrincipal: number,
  factorCompraAInterna: number
): number {
  const base = Number(precioPrincipal) || 0;
  const fC = Number(factorCompraAInterna);
  const fV = Number(unidad?.factorAInterna);
  if (base > 0 && Number.isFinite(fC) && fC > 0 && Number.isFinite(fV) && fV > 0) {
    return redondearPrecio2(base * (fV / fC));
  }
  const guardado = Number(unidad?.precio);
  if (Number.isFinite(guardado) && guardado > 0) return redondearPrecio2(guardado);
  return 0;
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
