export interface LineaVentaDetalleReporte {
  codigo: string;
  producto: string;
  cantidad: number;
  precio: number;
  importe: number;
}

export interface ComprobanteVentaDetalleReporte {
  idVenta: string;
  cliente: string;
  ruc: string;
  documento: string;
  fecha: string;
  estado: string;
  subTotal: number;
  igv: number;
  descuentos: number;
  total: number;
  lineas: LineaVentaDetalleReporte[];
}

export interface TotalesVentaDetalleReporte {
  subTotal: number;
  igv: number;
  descuentos: number;
  total: number;
  cantidadComprobantes: number;
}

export interface ReporteVentasDetalladoData {
  fechaInicio: string;
  fechaFin: string;
  comprobantes: ComprobanteVentaDetalleReporte[];
  totales: TotalesVentaDetalleReporte;
}
