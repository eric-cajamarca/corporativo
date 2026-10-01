export interface ConfiguracionFacturacion {
  idEmpresa: string;
  certificadoDigital?: string;
  claveCertificado?: string;
  usuarioSunat?: string;
  claveSunat?: string;
  modoPrueba: boolean;
  serieFactura: string;
  serieBoleta: string;
  serieNotaCredito: string;
  serieNotaDebito: string;
  ultimoNumeroFactura: number;
  ultimoNumeroBoleta: number;
  ultimoNumeroNotaCredito: number;
  ultimoNumeroNotaDebito: number;
}

export interface ComprobanteElectronico {
  idComprobanteElectronico: string;
  idVenta: string;
  tipoComprobante: 'FACTURA' | 'BOLETA' | 'NOTA_CREDITO' | 'NOTA_DEBITO';
  serie: string;
  numero: number;
  fechaEmision: string;
  fechaEnvioSunat?: string;
  estadoSunat: 'PENDIENTE' | 'ENVIADO' | 'ACEPTADO' | 'RECHAZADO' | 'ANULADO';
  xmlGenerado?: string;
  cdrSunat?: string;
  codigoRespuestaSunat?: string;
  descripcionRespuestaSunat?: string;
  hashXml?: string;
  qrCode?: string;
  venta?: string;
  cliente?: string;
}

export interface EstadoSunat {
  idEstado: number;
  codigo: string;
  descripcion: string;
  tipo: 'EXITO' | 'ERROR' | 'ADVERTENCIA';
}

export interface EstadisticasFacturacion {
  periodo: string;
  totalComprobantes: number;
  comprobantesAceptados: number;
  comprobantesRechazados: number;
  comprobantesPendientes: number;
  montoTotalFacturado: number;
  montoTotalAceptado: number;
  tasaAceptacion: number;
}