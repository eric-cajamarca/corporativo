export type EstadoSesionConteo = 'BORRADOR' | 'CERRADO';
export type TipoConteoFisico = 'INICIAL' | 'MENSUAL';

/** Resumen para listar sesiones en borrador (recuperar conteo sin aplicar). */
export interface InventarioFisicoSesionResumenDto {
  idSesion: string;
  idSucursal: string;
  nombreSucursal: string;
  tipoConteo: TipoConteoFisico;
  estado: EstadoSesionConteo;
  observaciones: string | null;
  fCreacion: string;
  idUbicacionInventario?: number | null;
  codigoUbicacionInventario?: string | null;
  cantidadLineas: number;
  lineasVerificadas: number;
}

export interface ConteoFisicoListarSesionesResponse {
  sesiones: InventarioFisicoSesionResumenDto[];
}

export interface InventarioFisicoSesionDto {
  idSesion: string;
  idEmpresa: string;
  idSucursal: string;
  nombreSucursal: string;
  tipoConteo: TipoConteoFisico;
  estado: EstadoSesionConteo;
  observaciones: string | null;
  fCreacion: string;
  /** Si la sesión se creó con inventario por ubicación, los movimientos aplican a esa ubicación. */
  idUbicacionInventario?: number | null;
  codigoUbicacionInventario?: string | null;
}

export interface InventarioFisicoLineaDto {
  idLinea: string;
  idSesion: string;
  idProducto: string;
  stockSistema: number;
  stockReal: number | null;
  verificado: boolean;
  notas: string | null;
  fModificacion: string;
  productoCodigo: string;
  productoDescripcion: string;
  marca: string;
}

export interface ConteoFisicoSesionResponse {
  sesion: InventarioFisicoSesionDto;
  lineas: InventarioFisicoLineaDto[];
}

export interface ConteoFisicoPreviewFila {
  idLinea: string;
  idProducto: string;
  productoCodigo: string;
  productoDescripcion: string;
  marca: string;
  stockSistemaAlGuardar: number;
  stockActual: number;
  stockReal: number | null;
  verificado: boolean;
  delta: number | null;
  seAplicaraMovimiento: boolean;
}

export interface ConteoFisicoPrevisualizarResponse {
  sesion: InventarioFisicoSesionDto;
  preview: ConteoFisicoPreviewFila[];
}

export interface ConteoFisicoCrearSesionResponse {
  idSesion: string;
  message: string;
}

export interface ConteoFisicoUpsertLineaResponse {
  linea: InventarioFisicoLineaDto | null;
  lineas: InventarioFisicoLineaDto[];
}

export interface ConteoFisicoAplicarResponse {
  message: string;
  movimientosGenerados: number;
  lineasProcesadas: number;
  empresasAfectadas?: string[];
  detalle: Array<{
    idProducto: string;
    idEmpresaDestino?: string;
    idSucursalDestino?: string;
    productoCodigo: string;
    stockActual: number;
    stockReal: number;
    delta: number;
  }>;
}
