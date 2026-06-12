export interface LineaCompraDetalleReporte {
  codigo: string;
  producto: string;
  cantidad: number;
  precio: number;
  importe: number;
}

export interface ComprobanteCompraDetalleReporte {
  idCompra: string;
  proveedor: string;
  ruc: string;
  documento: string;
  fecha: string;
  estado: string;
  subTotal: number;
  igv: number;
  descuentos: number;
  total: number;
  lineas: LineaCompraDetalleReporte[];
}

export interface TotalesCompraDetalleReporte {
  subTotal: number;
  igv: number;
  descuentos: number;
  total: number;
  cantidadComprobantes: number;
}

export interface ReporteComprasDetalladoData {
  fechaInicio: string;
  fechaFin: string;
  comprobantes: ComprobanteCompraDetalleReporte[];
  totales: TotalesCompraDetalleReporte;
}
