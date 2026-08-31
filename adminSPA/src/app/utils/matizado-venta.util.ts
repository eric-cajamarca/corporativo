import { MatizadoLineaPayload, MatizadoTinteLinea } from '../models/formula-matizado.model';
import { cantidadEnUnidadCompra } from './unidad-venta.util';

export function payloadMatizadoParaApi(item: { matizado?: MatizadoLineaPayload | null }): MatizadoLineaPayload | undefined {
  const m = item?.matizado;
  if (!m || !Array.isArray(m.tintes) || m.tintes.length === 0) return undefined;
  return {
    nombreColor: m.nombreColor ? String(m.nombreColor).trim() : undefined,
    marcaVehiculo: m.marcaVehiculo ? String(m.marcaVehiculo).trim() : undefined,
    modeloVehiculo: m.modeloVehiculo ? String(m.modeloVehiculo).trim() : undefined,
    placa: m.placa ? String(m.placa).trim() : undefined,
    idFormula: m.idFormula || undefined,
    guardarFormula: !!m.guardarFormula,
    cargoMatizado: m.cargoMatizado != null ? Number(m.cargoMatizado) : undefined,
    tintes: m.tintes.map((t) => ({
      idProductoTinte: t.idProductoTinte,
      gramos: Number(t.gramos)
    }))
  };
}

export function reescalarMatizadoPorCantidad(
  item: {
    matizado?: MatizadoLineaPayload | null;
    factorAInterna?: number | null;
    factorCompraAInterna?: number | null;
  },
  cantNueva: number
): void {
  if (!item?.matizado?.tintes?.length) return;
  const nuevo = cantidadEnUnidadCompra(item, cantNueva);
  const old = Number(item.matizado.factorEscala) || 0;
  if (nuevo <= 0) return;
  if (old > 0 && Math.abs(nuevo - old) > 1e-9) {
    const ratio = nuevo / old;
    item.matizado.tintes = item.matizado.tintes.map((t: MatizadoTinteLinea) => ({
      ...t,
      gramos: Math.round(Number(t.gramos) * ratio * 1e6) / 1e6
    }));
  }
  item.matizado.factorEscala = nuevo;
}

export function descripcionConColorMatizado(base: string, nombreColor?: string | null): string {
  const desc = String(base || '').trim();
  const color = String(nombreColor || '').trim();
  if (!color) return desc;
  if (!desc) return color;
  if (desc.toLowerCase().includes(color.toLowerCase())) return desc;
  return `${desc} — ${color}`;
}
