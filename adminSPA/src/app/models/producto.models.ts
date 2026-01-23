// Interfaces para productos - siguiendo reglas de arquitectura

export interface Producto {
  idProducto: string;
  Codigo: string;
  descripcion: string;
  cUnitario: number;
  fProduccion?: string;
  fVencimiento?: string;
  categoria: string;
  marca: string;
  presentacion: string;
  estado: number;
  alertaMinimo: number;
  alertaMaximo: number;
  fechaIngreso: string;
  fechaProduccion?: string;
  fechaVencimiento?: string;
}

export interface ProductoCreate {
  Codigo: string;
  idCategoria: number;
  idMarca: number;
  descripcion: string;
  idPresentacion: number;
  cUnitario: number;
  fProduccion?: string;
  fVencimiento?: string;
  idProducto?: string;
}

export interface ProductoResponse {
  data: Producto | Producto[];
  message?: string;
}