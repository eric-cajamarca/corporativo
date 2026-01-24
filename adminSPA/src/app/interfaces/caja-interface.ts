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
  idMovimiento: string;
  idCaja: string;
  idUsuario: string;
  idTipoMovimiento: number;
  fechaMovimiento: string;
  descripcion: string;
  monto: number;
  idMedioPago?: string;
  referencia?: string;
  tipoMovimiento?: string;
  medioPago?: string;
  usuario?: string;
}

export interface TipoMovimientoCaja {
  idTipoMovimiento: number;
  nombre: string;
  descripcion?: string;
  tipo: 'INGRESO' | 'EGRESO';
  requiereReferencia: boolean;
}

export interface ResumenCajaDiario {
  fecha: string;
  montoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoFinal: number;
  movimientos: MovimientoCaja[];
}