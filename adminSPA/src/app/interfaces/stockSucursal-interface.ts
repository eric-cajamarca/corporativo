import { Producto } from "./Producto-interface";


export interface StockSucursal {
  /** Identificador del lote (stock por Lotes); usar para editar/eliminar */
  idLote?: string;
  /** @deprecated Usar idLote; se mantiene por compatibilidad */
  idStockSucursal?: number;
  cantidad: number;
  ubicacion?: string;
  producto?: Producto;
  idSucursal?: string;
  idProducto?: string;
  nombreSucursal?: string;
  sucursal?: string;
}
