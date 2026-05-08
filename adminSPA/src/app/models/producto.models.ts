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
  /** Si true, el servidor asigna el siguiente código desde Correlativos (ignorar el valor mostrado en pantalla). */
  useCorrelativo?: boolean;
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

/** Respuesta de POST /productos/importacion/validar */
export interface ImportacionProductosValidarData {
  totalLeidas: number;
  validas: number;
  conError: number;
  errores: Array<{ fila: number; codigo: string; mensajes: string[] }>;
  vistaPrevia: Array<{
    fila: number;
    codigo: string;
    descripcion: string;
    cantidadInicial: number;
    costoUnitario: number;
    precioNormal: number;
    precioCliente: number;
    precioMayorista: number;
  }>;
}

/** Respuesta de POST /productos/importacion/ejecutar */
export interface ImportacionProductosEjecutarData {
  total: number;
  insertados: number;
  detalle: Array<{ fila: number; idProducto: string; codigo: string }>;
  erroresValidacion: Array<{ fila: number; codigo: string; mensajes: string[] }>;
  erroresEjecucion: Array<{ fila: number; codigo: string; mensajes: string[] }>;
  noImportadosExcel?: {
    fileName: string;
    mimeType: string;
    base64: string;
    total: number;
  } | null;
}