export type EstadoSesionConteo = 'BORRADOR' | 'CERRADO';
export type TipoConteoFisico = 'INICIAL' | 'MENSUAL';

export interface InventarioFisicoSesionDto {
  idSesion: string;
  idEmpresa: string;
  idSucursal: string;
  nombreSucursal: string;
  tipoConteo: TipoConteoFisico;
  estado: EstadoSesionConteo;
  observaciones: string | null;
  fCreacion: string;
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
  detalle: Array<{
    idProducto: string;
    productoCodigo: string;
    stockActual: number;
    stockReal: number;
    delta: number;
  }>;
}
