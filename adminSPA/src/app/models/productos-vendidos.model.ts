export interface ProductoVendidoFila {
  idEmpresa: string;
  idProducto: string;
  idDetalle: number | null;
  idVenta: number | null;
  fecha: string | null;
  producto: string;
  cantidad: number;
  costo: number;
  venta: number;
  utilidad: number;
  aliasEmpresa: string;
}

export interface ProductosVendidosTotales {
  cantidad: number;
  costo: number;
  venta: number;
  utilidad: number;
}

export interface ProductosVendidosResponse {
  items: ProductoVendidoFila[];
  totales: ProductosVendidosTotales;
}
