/** Fila de listado API GET comprobantes-compra-sunat (JOIN Compras por empresa). */
export interface ComprobanteCompraSunatListaItem {
  idComprobanteCompraSunat: string;
  idCompra: string;
  rucEmisor: string;
  razonSocialEmisor: string | null;
  tipoDocumento: string;
  serie: string;
  numero: string;
  fechaEmision: string;
  codigoMoneda: string | null;
  condicionPago: string;
  fechaVencimiento: string | null;
  tipoCambio: number | null;
  subTotal: number;
  igv: number;
  total: number;
  fRegistro: string;
  compCompra: string | null;
}
