// Interfaces para productos - siguiendo reglas de arquitectura

export interface Producto {
  idProducto: string;
  Codigo: string;
  codigo?: string;
  descripcion: string;
  cUnitario: number;
  fProduccion?: string;
  fVencimiento?: string;
  categoria: string;
  marca: string;
  presentacion: string;
  codigoPresentacion?: string;
  estado: number;
  alertaMinimo: number;
  alertaMaximo: number;
  fechaIngreso: string;
  fechaProduccion?: string;
  fechaVencimiento?: string;
  /** IDs para edición (respuesta GET por id) */
  idCategoria?: number;
  idMarca?: number;
  idPresentacion?: number;
  tipoProducto?: string;
  vecesVendidas?: number;
  facturar?: string;
  /** Si true, en el POS se puede cambiar el texto del ítem en el comprobante sin tocar el catálogo. */
  permiteDescripcionEnVenta?: boolean;
}

export interface LoteInicialCreate {
  idSucursal: string;
  costoUnitario: number;
  cantidadIngresada: number;
  ubicacion?: string;
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
  alertaMinimo?: number;
  alertaMaximo?: number;
  estado?: boolean;
  tipoProducto?: string;
  lote?: LoteInicialCreate | null;
  precioVenta?: number;
  permiteDescripcionEnVenta?: boolean;
}

export interface ProductoResponse {
  data: Producto | Producto[];
  message?: string;
}