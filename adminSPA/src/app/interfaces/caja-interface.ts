export interface Caja {
  idCaja: string;
  nombre: string;
  descripcion?: string;
  idSucursal: string;
  idEmpresa: string;
  estado: boolean;
  sucursal?: string;
  cajaAbierta?: boolean;
  fechaApertura?: string;
  montoInicial?: number;
  usuarioApertura?: string;
}

export interface AperturaCaja {
  idApertura: string;
  idCaja: string;
  idUsuario: string;
  fechaApertura: string;
  montoInicial: number;
  estado: boolean;
}

export interface MovimientoCaja {
  idMovimientoCaja?: string;
  idMovimiento?: string;
  idApertura?: string;
  idTipoMovimientoCaja?: number;
  idCaja?: string;
  idUsuario?: string;
  fechaMovimiento: string;
  concepto?: string;
  conceptoCatalogoDescripcion?: string;
  descripcion?: string;
  monto: number;
  idMedioPago?: string;
  referencia?: string;
  tipoMovimiento?: string;
  tipoOperacion?: string;
  medioPago?: string;
  moneda?: string;
  usuario?: string;
}

export interface TipoMovimientoCaja {
  idTipoMovimientoCaja: number;
  nombre: string;
  descripcion?: string;
  tipo: string;
}

export interface ResumenCajaDiario {
  fecha: string;
  montoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  movimientos: MovimientoCaja[];
}