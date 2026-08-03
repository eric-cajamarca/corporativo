export interface DashboardEjecutivo {
  periodo: string;
  fechaInicio?: string;
  fechaFin?: string;
  ventasTotales: number;
  costoVentas: number;
  utilidadBruta: number;
  gastosOperativos: number;
  utilidadOperativa: number;
  utilidadNeta: number;
  margenBruto: number;
  margenOperativo: number;
  margenNeto: number;
  crecimientoVentas: number;
  roi: number;
  inventarioTotal: number;
  cuentasPorCobrar: number;
  cuentasPorPagar: number;
  /** Flujo neto de caja del período (sin aperturas). */
  flujoCaja: number;
  flujoNetoEfectivo?: number;
  ingresosEfectivo?: number;
  patrimonio: number;
}

export interface BalanceGeneral {
  periodo: string;
  inventarioTotal?: number;
  cuentasPorCobrar?: number;
  cuentasPorPagar?: number;
  flujoNetoCaja?: number;
  activoCorriente: number;
  activoFijo: number;
  activoTotal: number;
  pasivoCorriente: number;
  pasivoLargoPlazo: number;
  pasivoTotal: number;
  patrimonio: number;
  ratioLiquidez: number;
  ratioEndeudamiento: number;
}

export interface FlujoCajaConcepto {
  concepto: string;
  tipoOperacion: 'I' | 'E';
  importe: number;
  informativo?: boolean;
}

export interface FlujoCajaFormaPago {
  formaPago: string;
  importe: number;
}

export interface FlujoCajaAnalisis {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  resumenConceptos: FlujoCajaConcepto[];
  movimientosIngresos: FlujoCajaFormaPago[];
  movimientosEgresos: FlujoCajaFormaPago[];
  ventasCredito: number;
  cobroCreditos: number;
  totalIngresos: number;
  totalEgresos: number;
  flujoNeto: number;
  ingresosEfectivo: number;
  egresosEfectivo: number;
  flujoNetoEfectivo: number;
  patrimonioEstimado?: number;
  inventarioTotal?: number;
  cuentasPorCobrar?: number;
  cuentasPorPagar?: number;
}

export interface FlujoCajaSerieMensual {
  periodo: string;
  serie: {
    periodo: string;
    fechaInicio: string;
    fechaFin: string;
    totalIngresos: number;
    totalEgresos: number;
    flujoNeto: number;
    ingresosEfectivo: number;
    flujoNetoEfectivo: number;
    patrimonio: number;
  }[];
}

export interface EstadoResultados {
  periodo: string;
  ingresos: number;
  costoVentas: number;
  utilidadBruta: number;
  gastosOperacion: number;
  utilidadOperacion: number;
  gastosFinancieros: number;
  utilidadAntesImpuestos: number;
  impuestos: number;
  utilidadNeta: number;
}

export interface RatiosFinancieros {
  // Liquidez
  ratioLiquidezCorriente: number;
  ratioLiquidezAcida: number;
  ratioLiquidezInmediata: number;

  // Solvencia
  ratioDeudaTotal: number;
  ratioDeudaPatrimonio: number;
  nivelEndeudamiento: number;
  coberturaIntereses: number;

  // Rentabilidad
  margenBruto: number;
  margenOperativo: number;
  margenNeto: number;
  ROA: number;
  ROE: number;
  ROI: number;

  // Rotación
  rotacionInventario: number;
  rotacionCuentasCobrar: number;
  rotacionCuentasPagar: number;
  cicloConversionEfectivo: number;
}

export interface AnalisisRentabilidad {
  tipo: 'PRODUCTO' | 'CATEGORIA' | 'CLIENTE' | 'VENDEDOR';
  periodo: string;
  items: ItemRentabilidad[];
}

export interface ItemRentabilidad {
  id: string;
  nombre: string;
  ventas: number;
  costo: number;
  utilidad: number;
  margen: number;
  cantidadVendida: number;
  precioPromedio: number;
}

export interface FlujoEfectivo {
  periodo: string;
  flujoOperativo: number;
  flujoInversion: number;
  flujoFinanciamiento: number;
  flujoNeto: number;
  saldoInicial: number;
  saldoFinal: number;
}

export interface EficienciaOperativa {
  periodo: string;
  costoVentas: number;
  costoAdministrativo: number;
  costoFinanciero: number;
  costoTotal: number;
  ventasNetas: number;
  eficienciaVentas: number;
  eficienciaAdministrativa: number;
  eficienciaFinanciera: number;
}

export interface ProyeccionVentas {
  periodoActual: string;
  proyeccionMensual: number[];
  proyeccionTrimestral: number[];
  crecimientoEsperado: number;
  factoresEstacionales: FactorEstacional[];
}

export interface FactorEstacional {
  mes: number;
  factor: number;
  descripcion?: string;
}

export interface PuntoEquilibrio {
  costoFijoTotal: number;
  costoVariableUnitario: number;
  precioVentaUnitario: number;
  volumenEquilibrio: number;
  ventasEquilibrio: number;
  margenContribucion: number;
}

export interface DiagnosticoFinanciero {
  saludFinanciera: 'EXCELENTE' | 'BUENA' | 'REGULAR' | 'DEFICIENTE';
  puntuacion: number;
  fortalezas: string[];
  debilidades: string[];
  recomendaciones: string[];
  ratiosCriticos: RatioCritico[];
}

export interface RatioCritico {
  nombre: string;
  valor: number;
  rangoOptimo: string;
  estado: 'OPTIMO' | 'ACEPTABLE' | 'PREOCUPANTE' | 'CRITICO';
}

export interface GastoOperativo {
  idGasto: string;
  fecha: string;
  fechaFin?: string | null;
  tipo: string;
  monto: number;
  descripcion?: string | null;
  esRecurrente?: boolean;
  activo?: boolean;
  fRegistro?: string | null;
}

export interface GastosAnalisisRespuesta {
  delPeriodo: GastoOperativo[];
  recurrentes: GastoOperativo[];
  totalPeriodo: number;
  fechaInicio?: string;
  fechaFin?: string;
}