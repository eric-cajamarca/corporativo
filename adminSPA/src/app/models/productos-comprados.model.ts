export interface ProductoCompradoFila {
  idEmpresa: string;
  idProducto: string;
  idDetalleCompra: number | null;
  idCompra: string | null;
  fecha: string | null;
  producto: string;
  proveedor: string;
  cantidad: number;
  precio: number;
  importe: number;
  aliasEmpresa: string;
}

export interface ProductosCompradosTotales {
  cantidad: number;
  importe: number;
}

export interface ProductosCompradosResponse {
  items: ProductoCompradoFila[];
  totales: ProductosCompradosTotales;
}
