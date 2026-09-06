/**
 * Borrador local de ingreso/salida de inventario (localStorage).
 * No se guarda idEmpresa en el payload; la clave de storage ya lo aísla.
 */
export type MovimientoInventarioBorradorModo = 'ingreso' | 'salida';

export interface MovimientoInventarioBorradorCabecera {
  tipoMovimiento: string;
  idSucursal: string;
  idSucursalDestino: string;
  fechaMovimiento: string;
  idComprobante: string;
  docRelacionado: string;
  observaciones: string;
}

export interface MovimientoInventarioBorradorFila {
  idProducto: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  fechaVencimiento: string;
  numeroLote: string;
}

export interface MovimientoInventarioBorrador {
  version: 1;
  modo: MovimientoInventarioBorradorModo;
  fechaActualizacion: string;
  cabecera: MovimientoInventarioBorradorCabecera;
  filas: MovimientoInventarioBorradorFila[];
}
