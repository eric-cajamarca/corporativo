export interface StockActualItem {
  idProducto: string;
  idEmpresa: string;
  codigo: string;
  descripcion: string;
  /** IDs para edición de maestro en conteo físico (listarStockActual). */
  idCategoria?: number;
  idPresentacion?: number;
  idMarca?: number;
  categoria: string;
  marca: string;
  unidad: string;
  stock: number;
  cUnitario: number;
  alertaMinimo: number | null;
  aliasEmpresa: string;
  valorizado: number;
}

export interface StockActualResponse {
  items: StockActualItem[];
  totalProductos: number;
  totalValorizado: number;
}
