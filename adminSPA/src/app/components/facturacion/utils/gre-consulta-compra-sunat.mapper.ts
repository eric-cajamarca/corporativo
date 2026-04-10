/**
 * Convierte la respuesta normalizada de POST consultar-comprobante-sunat (Factiliza)
 * al shape que usan los formularios de guía (comprobanteOrigen + serie/número).
 * Motivo compra (02): el emisor del XML es el proveedor; el cliente es quien recibe (su empresa).
 */

function numVal(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'object' && v !== null && '_' in (v as object)) {
    return parseFloat(String((v as { _: string })._).replace(',', '.')) || 0;
  }
  return parseFloat(String(v).replace(',', '.')) || 0;
}

function strVal(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && '_' in (v as object)) {
    return String((v as { _: string })._).trim();
  }
  return String(v).trim();
}

export interface ComprobanteOrigenGreShape {
  serie: string;
  numero: string;
  tipoComprobante: string;
  rucEmpresa: string;
  rucEmisor: string;
  /** Razón social del emisor (proveedor en compras); útil para GRE transportista → remitente. */
  nombreEmisor: string;
  cliente: string;
  razon_social: string;
  documento_cliente: string;
  rucCliente: string;
  clienteDireccion: string;
  ubigeoCliente: string;
  codLocalCliente: string;
  total: number;
  items: {
    codigo: string;
    descripcion: string;
    cantidad: number;
    unidad: string;
    pVenta: number;
    total: number;
    idDetalle: number;
    numeroLinea: number;
  }[];
  idEstadoSunat: number | null;
}

export function mapearSunatCompraNormalizadoAComprobanteOrigenGre(data: unknown): {
  comprobanteOrigen: ComprobanteOrigenGreShape;
  buscarSerie: string;
  buscarNumero: string;
} {
  const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const info = (d['informacionGeneral'] as Record<string, unknown>) || {};
  const emisor = (d['emisor'] as Record<string, unknown>) || {};
  const cliente = (d['cliente'] as Record<string, unknown>) || {};
  const totales = (d['totales'] as Record<string, unknown>) || {};

  const serieNum = strVal(info['serieNumero']);
  const dash = serieNum.indexOf('-');
  const serie = dash >= 0 ? serieNum.slice(0, dash).trim() : serieNum.trim();
  const numeroRaw = dash >= 0 ? serieNum.slice(dash + 1).trim() : '';
  const numero = numeroRaw.replace(/^0+/, '') || numeroRaw;

  const rawDet = d['detalles'];
  const detalles = Array.isArray(rawDet) ? rawDet : [];
  const items = detalles.map((it: unknown, idx: number) => {
    const line = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
    const cant = numVal(line['cantidad']);
    const pUnit = numVal(line['precioUnitario']);
    const vVenta = numVal(line['valorVenta']);
    return {
      codigo: String(line['codigoProducto'] || line['codigo'] || '').trim() || `L${idx + 1}`,
      descripcion: String(line['descripcion'] || '').trim(),
      cantidad: cant || 0,
      unidad: String(line['unidadMedida'] || 'NIU').trim(),
      pVenta: pUnit,
      total: vVenta || cant * pUnit,
      idDetalle: idx,
      numeroLinea: idx + 1
    };
  });

  const tipoRaw = strVal(info['tipoDocumento']);
  const tipoDoc = tipoRaw ? tipoRaw.padStart(2, '0').slice(-2) : '01';
  const docCliente = String(strVal(cliente['numeroDocumento'])).replace(/\D/g, '').slice(0, 11);
  const rucEmisor = String(strVal(emisor['ruc'])).replace(/\D/g, '').slice(0, 11);
  const nomEmisor = strVal(emisor['razonSocial']);
  const nomCliente = strVal(cliente['razonSocial']);

  const totalVenta =
    numVal(totales['totalVenta']) || numVal(totales['totalPagar']) || numVal(totales['totalValorVenta']);

  const comprobanteOrigen: ComprobanteOrigenGreShape = {
    serie,
    numero,
    tipoComprobante: tipoDoc,
    rucEmpresa: rucEmisor,
    rucEmisor,
    nombreEmisor: nomEmisor,
    cliente: nomCliente,
    razon_social: nomCliente,
    documento_cliente: docCliente,
    rucCliente: docCliente,
    clienteDireccion: '',
    ubigeoCliente: '',
    codLocalCliente: '',
    total: totalVenta,
    items,
    idEstadoSunat: 1
  };

  return { comprobanteOrigen, buscarSerie: serie, buscarNumero: numero };
}
