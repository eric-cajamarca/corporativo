export interface Producto {
  idProducto: number;
  Codigo: string;
  descripcion: string;
  cUnitario?: number;
  fProduccion?: string;
  fVencimiento?: string;
  alertaMinimo?: number;
  alertaMaximo?: Number;
  facturar?: string;
  idCategoria: number;
  nombreCategoria: string;
  idPresentacion: number;
  nombrePresentacion: string;
  idMarca: number;
  nombreMarca: string;
  
}
