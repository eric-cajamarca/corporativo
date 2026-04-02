export interface MovimientoInventarioCabecera {
  idMovimiento: number;
  idGrupoMovimiento: string | null;
  fecha: string;
  fMovimiento: string;
  tipoMovimiento: string;
  codigoTipoMovimiento: string | null;
  docRelacionado: string | null;
  observaciones: string | null;
  idSucursal: string;
  sucursal: string;
  usuario: string;
  totalLineas: number;
  totalImporte: number;
  compCodigo: string | null;
  compNombre: string | null;
}

/** Respuesta paginada de GET movimientos-resumen */
export interface MovimientosResumenPaginados {
  items: MovimientoInventarioCabecera[];
  total: number;
}

export interface MovimientoInventarioLineaDetalle {
  idMovimiento: number;
  idSucursal?: string;
  /** Nombre de la sucursal donde aplica esta línea (salida o entrada). */
  sucursal?: string | null;
  idProducto: string;
  /** EN | SA | AJ (código en BD). */
  tipoMovimiento: string;
  cantidad: number;
  costoUnitario: number | null;
  fMovimiento: string;
  docRelacionado: string | null;
  observaciones: string | null;
  productoCodigo: string | null;
  productoDescripcion: string | null;
}

/** Etiquetas como en el formulario Ingresos y salidas */
export const ETIQUETA_CODIGO_TIPO_MOVIMIENTO: Record<string, string> = {
  INVENTARIO_INICIAL: 'Inventario inicial',
  ENTRADA_VARIA: 'Entrada varia',
  REAJUSTE_POSITIVO: 'Reajuste de stock (positivo)',
  REAJUSTE_NEGATIVO: 'Reajuste de stock (negativo)',
  SALIDA_MERMA: 'Salida / Merma',
  DEVOLUCION: 'Devoluciones',
  TRANSFERENCIA: 'Transferencia entre sucursales'
};

export function etiquetaTipoMovimiento(codigoTipo: string | null | undefined, tipoBd: string | null | undefined): string {
  if (codigoTipo && ETIQUETA_CODIGO_TIPO_MOVIMIENTO[codigoTipo]) {
    return ETIQUETA_CODIGO_TIPO_MOVIMIENTO[codigoTipo];
  }
  const t = String(tipoBd || '').toUpperCase();
  if (t === 'EN') return 'Entrada';
  if (t === 'SA') return 'Salida / Merma';
  if (t === 'AJ') return 'Reajuste';
  return tipoBd || '—';
}
