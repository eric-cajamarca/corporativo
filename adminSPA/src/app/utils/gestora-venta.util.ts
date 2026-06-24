/** Opciones de comprobante destino en venta corporativa (empresa gestora). */
export const COMPROBANTES_DESTINO_GESTORA = [
  { codigo: 'NV', nombre: 'Nota de Venta' },
  { codigo: '03', nombre: 'Boleta' },
  { codigo: '01', nombre: 'Factura' }
] as const;

export type CodigoComprobanteDestinoGestora = (typeof COMPROBANTES_DESTINO_GESTORA)[number]['codigo'];

/** Catálogo gestora: incluye productos de todas las empresas gestionadas (sin filtrar por JWT). */
export function filtrarFilasCatalogoGestora<T>(filas: T[] | null | undefined): T[] {
  return filas ?? [];
}

/** En gestora cualquier línea del catálogo consolidado es vendible. */
export function productoPermitidoEnCarritoGestora(): boolean {
  return true;
}

/**
 * Cotización agrupada: solo gestora y solo si el carrito mezcla más de una empresa.
 */
export function cotizacionDebeMarcarseAgrupadaGestora(
  esGestora: boolean,
  carrito: Array<{ idEmpresa?: string | null }> | null | undefined
): boolean {
  if (!esGestora || !carrito?.length) {
    return false;
  }
  const ids = new Set<string>();
  for (const item of carrito) {
    const id = item?.idEmpresa != null && String(item.idEmpresa).trim() !== '' ? String(item.idEmpresa) : null;
    if (id) {
      ids.add(id);
    }
  }
  return ids.size > 1;
}

/** Gestora: búsqueda API sin acotar a una sucursal (catálogo multiempresa). */
export function idSucursalBusquedaApiGestora(): undefined {
  return undefined;
}

/** Etiqueta sucursal en listados de búsqueda (alias empresa + sucursal). */
export function textoSucursalLineaGestora(producto: {
  aliasEmpresa?: string | null;
  sucursal?: string | null;
}): string {
  const alias = (producto?.aliasEmpresa || '').trim();
  const suc = (producto?.sucursal || '').trim();
  return alias ? `${alias} - ${suc}` : suc;
}

/**
 * Código SUNAT efectivo al cobrar: en gestora se usa el comprobante destino (01/03/NV),
 * no el código VA del comprobante de cabecera.
 */
export function codigoComprobanteSunatGestora(tipoComprobanteDestino: string | null | undefined): string {
  return String(tipoComprobanteDestino || 'NV').trim();
}

/** Sincroniza tipoComprobanteDestino desde el código del comprobante VA seleccionado. */
export function sincronizarTipoComprobanteDestinoGestora(
  codigo: string | null | undefined,
  _tipoActual?: string
): string {
  const c = String(codigo ?? '').trim();
  const permitidos = new Set(COMPROBANTES_DESTINO_GESTORA.map((o) => o.codigo));
  return permitidos.has(c as CodigoComprobanteDestinoGestora) ? c : 'NV';
}

export function esFacturaOBoletaGestora(tipoComprobanteDestino: string | null | undefined): boolean {
  const c = String(tipoComprobanteDestino || '').trim().toUpperCase();
  return c === '01' || c === '03';
}

export function esNotaVentaGestora(tipoComprobanteDestino: string | null | undefined): boolean {
  return String(tipoComprobanteDestino || '').trim().toUpperCase() === 'NV';
}

/**
 * Descuento en total por línea: en gestora depende de la config de la empresa del producto.
 */
export function aplicaDescuentoEnTotalLineaGestora(params: {
  descuentoEnTotalConfigListo: boolean;
  usarDescuentoEnTotal: boolean;
  idEmpresaJwt: string;
  idEmpresaLinea: string | null | undefined;
  descuentoPorEmpresa: ReadonlyMap<string, boolean>;
}): boolean {
  if (!params.descuentoEnTotalConfigListo) {
    return false;
  }
  const idJwt = params.idEmpresaJwt.trim().toLowerCase();
  const idEmp =
    params.idEmpresaLinea != null && String(params.idEmpresaLinea).trim() !== ''
      ? String(params.idEmpresaLinea).trim().toLowerCase()
      : idJwt;
  if (params.descuentoPorEmpresa.has(idEmp)) {
    return params.descuentoPorEmpresa.get(idEmp)!;
  }
  return params.usarDescuentoEnTotal;
}
