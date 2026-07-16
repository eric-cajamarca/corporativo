export interface HistorialVentaProductoItem {
  idVenta: string;
  idDetalle?: number | string;
  fecha: string;
  comprobante: string;
  cliente: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface HistorialCompraProductoItem {
  idCompra: string;
  idDetalleCompra?: number | string;
  fecha: string;
  comprobante: string;
  proveedor: string;
  cantidad: number;
  precio: number;
  total: number;
}

export interface HistorialProductoResponse<T> {
  data?: T[];
  message?: string;
}

/** Resultado al cerrar el modal con "Usar este precio". */
export interface HistorialProductoPrecioSeleccionado {
  precio: number;
  origen: 'venta' | 'compra';
}
