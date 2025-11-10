import { Producto } from "./Producto-interface";
import { Sucursal } from "./sucursal-interface";
import {Categoria} from "./categoria-interface";
import { Presentacion } from "./presentacion-interface";
import { Marca } from "./marca-interface";


export interface StockSucursal {
  idProducto: number;
  idSucursal: number;
  producto?: Producto;
  sucursal?: Sucursal;
  categoria?: Categoria;
  presentacion?: Presentacion;
  marca?: Marca;
}
