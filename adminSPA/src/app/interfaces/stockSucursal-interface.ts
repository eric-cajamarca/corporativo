import { Producto } from "./Producto-interface";


export interface StockSucursal {
  idStockSucursal: number;
  cantidad: number;
  ubicacion: string;
  producto?: Producto;
  idSucursal?: string;
  nombreSucursal?:string;
}
