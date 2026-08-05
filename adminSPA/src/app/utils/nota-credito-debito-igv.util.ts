import {
  armarDetallesConIgv,
  calcularMontoIgv,
  redondear2
} from './venta-igv.util';

/** Modo de edición de ítems según motivo SUNAT. */
export type ModoEdicionNota = 'bloqueo' | 'cantidad' | 'precio' | 'cantidad_precio';

export interface ItemNotaEditable {
  idProducto: string;
  descripcion?: string;
  cantidad: number;
  pVenta: number;
  subtotal: number;
  total: number;
  /** Snapshot del comprobante origen (no mutar). */
  cantidadOrigen: number;
  pVentaOrigen: number;
  subtotalOrigen: number;
  totalOrigen: number;
}

export interface ConfigIgvNota {
  tieneIgv: boolean;
  porcentaje: number;
  precioIncluyeIgv: boolean;
}

/**
 * Cat. 09 (NC) / Cat. 10 (ND) → qué se puede editar.
 * - bloqueo: anulación / devolución total / corrección descripción
 * - cantidad: devolución por ítem (prorratea IGV del origen)
 * - precio: descuentos / disminución / ND (recalcula IGV)
 * - cantidad_precio: otros conceptos
 */
export function modoEdicionPorMotivo(tipoNota: '07' | '08', codigoMotivo: string): ModoEdicionNota {
  const c = String(codigoMotivo || '01').trim();
  const codigo = c.length === 1 ? `0${c}` : c.slice(0, 2);

  if (tipoNota === '08') {
    // ND: intereses / aumento / penalidades → montos editables con IGV.
    return 'precio';
  }

  if (codigo === '01' || codigo === '02' || codigo === '03' || codigo === '06') {
    return 'bloqueo';
  }
  if (codigo === '07') {
    return 'cantidad';
  }
  if (codigo === '04' || codigo === '05' || codigo === '08' || codigo === '09') {
    return 'precio';
  }
  return 'cantidad_precio';
}

export function puedeEditarCantidad(modo: ModoEdicionNota): boolean {
  return modo === 'cantidad' || modo === 'cantidad_precio';
}

export function puedeEditarPrecio(modo: ModoEdicionNota): boolean {
  return modo === 'precio' || modo === 'cantidad_precio';
}

export function origenEsGravado(
  ventaIgv: number | null | undefined,
  items: { subtotal: number; total: number }[]
): boolean {
  if ((Number(ventaIgv) || 0) > 0.001) return true;
  return items.some((it) => redondear2((Number(it.total) || 0) - (Number(it.subtotal) || 0)) > 0.001);
}

/**
 * Recalcula una línea según modo:
 * - bloqueo: restaura origen
 * - cantidad: prorratea subtotal/total del origen
 * - precio / cantidad_precio: recalcula con venta-igv.util (o sin IGV)
 */
export function recalcularItemNota(
  item: ItemNotaEditable,
  modo: ModoEdicionNota,
  cfg: ConfigIgvNota
): void {
  if (modo === 'bloqueo') {
    item.cantidad = item.cantidadOrigen;
    item.pVenta = item.pVentaOrigen;
    item.subtotal = item.subtotalOrigen;
    item.total = item.totalOrigen;
    return;
  }

  let cant = Number(item.cantidad) || 0;
  if (cant < 0) cant = 0;

  if (modo === 'cantidad') {
    const cantOri = Number(item.cantidadOrigen) || 0;
    if (cantOri > 0 && cant > cantOri) {
      cant = cantOri;
    }
    item.cantidad = cant;
    item.pVenta = item.pVentaOrigen;
    if (cantOri <= 0 || cant <= 0) {
      item.subtotal = 0;
      item.total = 0;
      return;
    }
    const factor = cant / cantOri;
    item.subtotal = redondear2(item.subtotalOrigen * factor);
    item.total = redondear2(item.totalOrigen * factor);
    // Si el origen era gravado y por redondeo se perdió el diferencial, reponer IGV unitario.
    const igvOri = redondear2(item.totalOrigen - item.subtotalOrigen);
    if (igvOri > 0.001 && redondear2(item.total - item.subtotal) <= 0) {
      const igv = redondear2(igvOri * factor);
      item.total = redondear2(item.subtotal + igv);
    }
    return;
  }

  // precio o cantidad_precio
  if (modo === 'precio') {
    // Mantener cantidad del origen (descuento/aumento sobre ítems originales).
    item.cantidad = item.cantidadOrigen;
    cant = item.cantidadOrigen;
  } else if (modo === 'cantidad_precio') {
    const cantOri = Number(item.cantidadOrigen) || 0;
    if (cantOri > 0 && cant > cantOri) {
      cant = cantOri;
    }
    item.cantidad = cant;
  }

  const pv = Math.max(0, Number(item.pVenta) || 0);
  item.pVenta = pv;

  if (cant <= 0) {
    item.subtotal = 0;
    item.total = 0;
    return;
  }

  const montos = armarDetallesConIgv(
    [{ cantidad: cant, pVenta: pv }],
    cfg.porcentaje,
    cfg.precioIncluyeIgv,
    cfg.tieneIgv
  )[0];

  item.subtotal = montos.subtotal;
  item.total = montos.total;
}

/** Totales de cabecera a partir de ítems. */
export function totalesNotaDesdeItems(items: { subtotal: number; total: number }[]): {
  subtotal: number;
  igv: number;
  total: number;
} {
  const subtotal = redondear2(items.reduce((s, it) => s + (Number(it.subtotal) || 0), 0));
  const total = redondear2(items.reduce((s, it) => s + (Number(it.total) || 0), 0));
  const igv = redondear2(total - subtotal);
  return { subtotal, igv: igv > 0 ? igv : 0, total };
}

/** Ayuda UI según modo. */
export function textoAyudaModoEdicion(modo: ModoEdicionNota): string {
  switch (modo) {
    case 'bloqueo':
      return 'Este motivo no permite modificar montos: se copia el comprobante origen (base + IGV).';
    case 'cantidad':
      return 'Devolución por ítem: solo puede reducir cantidades. El IGV se prorratea del origen.';
    case 'precio':
      return 'Puede modificar el precio/importe. El IGV se recalcula según la configuración de impuestos.';
    default:
      return 'Puede ajustar cantidad (≤ origen) y precio. El IGV se recalcula según impuestos.';
  }
}

export { calcularMontoIgv, redondear2 };
