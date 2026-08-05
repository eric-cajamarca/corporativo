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
  /** Código producto SUNAT (UNSPSC 8 dígitos, Cat. 25 / anexos 25.1–25.3). */
  codigoProductoSunat?: string | null;
  /** null = sin decidir, true = sí aplica, false = no aplica. */
  requiereCodigoSunat?: boolean | null;
  revisadoSunat?: boolean;
  anexoSunatSugerido?: string | null;
  codigoSunatSugerido?: string | null;
}

export interface CatalogoProductoSunatItem {
  codigo: string;
  anexo: string;
  descripcion: string;
  partidaArancelaria?: string;
  etiquetaAnexo?: string;
  score?: number;
}

export interface ProductoCodigoSunatPendiente {
  idProducto: string;
  codigo: string;
  descripcion: string;
  categoria: string;
  marca: string;
  codigoProductoSunat?: string | null;
  requiereCodigoSunat?: boolean | null;
  revisadoSunat?: boolean;
  anexoSunatSugerido?: string | null;
  codigoSunatSugerido?: string | null;
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
  codigoProductoSunat?: string | null;
  requiereCodigoSunat?: boolean | null;
  revisadoSunat?: boolean;
  anexoSunatSugerido?: string | null;
  codigoSunatSugerido?: string | null;
  /** Empresa gestora: crear el producto en esta empresa gestionada. */
  idEmpresaDestino?: string;
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
    ubicacion?: string;
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

/** Fila de GET /productos/:id/stock-ubicaciones */
export interface StockUbicacionProductoFila {
  idUbicacion: number;
  codigoUbicacion: string;
  prioridad: number;
  cantidad: number;
  /** Fila sintética: stock en Lotes sin reflejo completo en LotesUbicacion */
  esSinUbicacion?: boolean;
}