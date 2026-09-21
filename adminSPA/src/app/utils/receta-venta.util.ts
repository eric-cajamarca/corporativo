import { CondicionVentaFarmacia, LineaRecetaVenta } from '../models/receta-venta.model';

const CONDICIONES_RECETA = new Set(['RECETA', 'RETENIDA', 'ESPECIAL']);

export function normalizarCondicionVenta(valor?: string | null): CondicionVentaFarmacia {
  const s = String(valor || 'LIBRE').trim().toUpperCase();
  if (s === 'LIBRE' || s === 'RECETA' || s === 'RETENIDA' || s === 'ESPECIAL') return s;
  return 'LIBRE';
}

export function requiereReceta(condicionVenta?: string | null): boolean {
  return CONDICIONES_RECETA.has(normalizarCondicionVenta(condicionVenta));
}

export function lineasQueRequierenReceta(
  carrito: Array<{ idProducto?: string; descripcion?: string; cantidad?: number; condicionVenta?: string | null }>
): LineaRecetaVenta[] {
  return (carrito || [])
    .filter((l) => requiereReceta(l.condicionVenta))
    .map((l) => ({
      idProducto: String(l.idProducto || ''),
      descripcion: String(l.descripcion || ''),
      cantidad: Number(l.cantidad) || 0,
      condicionVenta: l.condicionVenta
    }))
    .filter((l) => l.idProducto);
}

export function etiquetaCondicionVenta(condicionVenta?: string | null): string {
  const c = normalizarCondicionVenta(condicionVenta);
  if (c === 'RETENIDA') return 'Receta retenida';
  if (c === 'ESPECIAL') return 'Receta especial';
  if (c === 'RECETA') return 'Receta';
  return 'Libre';
}
