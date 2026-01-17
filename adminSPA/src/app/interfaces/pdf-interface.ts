export interface Empresa {
  logo: string;
  nombre: string;
  ruc: string;
  direccion: string;
  telefono: string;
}

export interface Cliente {
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono?: string;
  email?: string;
}

export interface Item {
  cant: number;
  desc: string;
  pUnit: number;
  importe: number;
}

export interface Totales {
  gravado: number;
  inafecto: number;
  exonerado: number;
  exportacion: number;
  descuentos: number;
  gratuitos: number;
  igv: number;
  isc: number;
  icbper: number;
  total: number;
}

export interface DatosPdf {
  comprobante: string;
  emp: Empresa;
  cli: Cliente;
  items: Item[];
  cantidadLetras: string;
  totales: Totales;
  resumenDigital: string;
  observaciones: string[];
}