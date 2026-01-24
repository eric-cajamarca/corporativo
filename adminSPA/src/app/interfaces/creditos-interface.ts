export interface CreditoCliente {
  idCredito: string;
  idCliente: string;
  idVenta: string;
  idUsuario: string;
  fechaCredito: string;
  montoTotal: number;
  interes: number;
  numeroCuotas: number;
  cuotaInicial?: number;
  estado: 'PENDIENTE' | 'ACTIVO' | 'COMPLETADO' | 'CANCELADO';
  cliente?: string;
  usuario?: string;
  cuotasPendientes?: number;
  totalPagado?: number;
  saldoPendiente?: number;
}

export interface CuotaCredito {
  idCuota: string;
  idCredito: string;
  numeroCuota: number;
  fechaVencimiento: string;
  montoCuota: number;
  interes: number;
  capital: number;
  saldoPendiente: number;
  estado: 'PENDIENTE' | 'PAGADO' | 'VENCIDO';
  fechaPago?: string;
  montoPagado?: number;
}

export interface PagoCuota {
  idPago: string;
  idCuota: string;
  idUsuario: string;
  fechaPago: string;
  montoPagado: number;
  interesPagado: number;
  capitalPagado: number;
  formaPago: string;
  referencia?: string;
  observaciones?: string;
}

export interface ResumenCreditos {
  totalCreditos: number;
  creditosActivos: number;
  totalMontoOtorgado: number;
  totalSaldoPendiente: number;
  totalPagado: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  eficienciaCobro: number;
  tasaCobro: number;
}

export interface EficienciaCobro {
  idUsuario: string;
  usuario: string;
  totalCreditosOtorgados: number;
  totalMontoOtorgado: number;
  totalCobrado: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  tasaCobro: number;
  promedioDiasCobro: number;
}