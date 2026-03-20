export interface DespachoResumen {
  idDespacho: string;
  fechaDespacho: string;
  estado: string;
  tipoDespacho: string;
  usuarioDespacho: string;
}

export interface DetalleDespachoLinea {
  idDetalleDespacho: string;
  idProducto: string;
  productoDescripcion: string;
  cantidadSolicitada: number;
  cantidadDespachada: number;
  ubicacionOrigen?: string;
  ubicacionDestino?: string;
}

export interface DevolucionDespachoItemRequest {
  idDetalleDespacho: string;
  cantidadDevuelta: number;
  notas?: string;
}

export interface CrearDevolucionDespachoRequest {
  observaciones?: string;
  items: DevolucionDespachoItemRequest[];
}

export interface DevolucionDespachoResumen {
  idDevolucionDespacho: string;
  fechaDevolucion: string;
  observaciones?: string;
  cantidadTotalDevuelta: number;
  usuarioNombre?: string;
}

export interface DevolucionDespachoDetalle {
  idDevolucionDetalle: string;
  idDevolucionDespacho: string;
  idDetalleDespacho: string;
  idDetalleVenta: number;
  idProducto: string;
  productoDescripcion: string;
  cantidadDevuelta: number;
  notas?: string;
}
