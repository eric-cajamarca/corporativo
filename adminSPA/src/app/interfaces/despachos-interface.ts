export interface Despacho {
  idDespacho: string;
  idVenta: string;
  idTipoDespacho: number;
  idUsuario: string;
  fechaDespacho: string;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'CANCELADO';
  observaciones?: string;
  tipoDespacho?: string;
  usuario?: string;
  venta?: string;
  detalles?: DetalleDespacho[];
}

export interface DetalleDespacho {
  idDetalle: string;
  idDespacho: string;
  idProducto: string;
  idLote?: string;
  cantidadSolicitada: number;
  cantidadDespachada: number;
  cantidadPendiente: number;
  precioUnitario: number;
  subtotal: number;
  producto?: string;
  lote?: string;
}

export interface TipoDespacho {
  idTipoDespacho: number;
  nombre: string;
  descripcion?: string;
  requiereControl: boolean;
}