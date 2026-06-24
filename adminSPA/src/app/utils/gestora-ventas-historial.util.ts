import { VentaAgrupadaListado } from '../services/ventas.service';

export interface FiltrosFechaHistorial {
  fechaDesde?: string;
  fechaHasta?: string;
}

/** Filtra ventas agrupadas (VA) por rango de fechas y texto de búsqueda. */
export function filtrarVentasAgrupadasGestora(
  origen: VentaAgrupadaListado[],
  fechas: FiltrosFechaHistorial,
  textoBusqueda: string
): VentaAgrupadaListado[] {
  let list = [...origen];
  if (fechas.fechaDesde) {
    list = list.filter((v) => (v.fEmision || '').slice(0, 10) >= fechas.fechaDesde!);
  }
  if (fechas.fechaHasta) {
    list = list.filter((v) => (v.fEmision || '').slice(0, 10) <= fechas.fechaHasta!);
  }
  const q = (textoBusqueda || '').trim();
  if (q) {
    list = list.filter((v) => coincideBusquedaVentaAgrupadaGestora(v, q));
  }
  return list;
}

export function coincideBusquedaVentaAgrupadaGestora(v: VentaAgrupadaListado, texto: string): boolean {
  const raw = texto.trim();
  if (!raw) {
    return true;
  }
  const n = raw.toLowerCase();
  const idVa = (v.idVentaAgrupada || '').toLowerCase();
  const ruc = (v.clienteRuc || '').toLowerCase();
  const rs = (v.clienteRazonSocial || '').toLowerCase();
  const comp = (v.compVenta || '').toLowerCase();
  return idVa.includes(n) || ruc.includes(n) || rs.includes(n) || comp.includes(n);
}
