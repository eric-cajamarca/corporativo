const axios = require('axios');

const BASE_URL = (process.env.PDF_BACKEND_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PDF_BACKEND_TIMEOUT_MS) || 90000;

function pdfUrl() {
  return `${BASE_URL}/api/reports/generate-pdf`;
}

function excelGenerateUrl() {
  return `${BASE_URL}/api/reports/generate-excel`;
}

function excelParseUrl() {
  return `${BASE_URL}/api/reports/parse-excel`;
}

/**
 * Genera PDF de comprobante/cotización vía pdf-backend.
 * @returns {Promise<Buffer>}
 */
async function generarPdfComprobanteVenta(datos, formato = 'A4') {
  const res = await axios.post(
    pdfUrl(),
    {
      datos: { ...datos, nombreArchivo: datos.nombreArchivo || 'cotizacion.pdf' },
      tipo: 'comprobante-venta',
      fontSize: 10,
      formato: formato === 'ticket' || formato === 'A5' ? formato : 'A4'
    },
    { responseType: 'arraybuffer', timeout: TIMEOUT_MS, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) {
    const errText = Buffer.isBuffer(res.data) ? res.data.toString('utf8').slice(0, 300) : String(res.data);
    throw new Error(`pdf-backend HTTP ${res.status}: ${errText}`);
  }
  return Buffer.from(res.data);
}

/**
 * Genera un xlsx con tabla simple (headers + filas) vía pdf-backend.
 * @param {{ columns: string[], rows: any[][], title?: string, worksheetName?: string }} data
 * @returns {Promise<Buffer>}
 */
async function generarExcel(data) {
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) {
    throw new Error('PDF_BACKEND_GENERAR_EXCEL_DATOS_INVALIDOS');
  }
  const res = await axios.post(
    excelGenerateUrl(),
    { data },
    { responseType: 'arraybuffer', timeout: TIMEOUT_MS, validateStatus: () => true }
  );
  if (res.status < 200 || res.status >= 300) {
    const errText = Buffer.isBuffer(res.data) ? res.data.toString('utf8').slice(0, 300) : String(res.data);
    throw new Error(`pdf-backend HTTP ${res.status}: ${errText}`);
  }
  return Buffer.from(res.data);
}

/**
 * Sube un buffer xlsx a pdf-backend y devuelve { sheetName, headers, rows[] }.
 * Los errores conocidos del parser viajan como HTTP 400 con { code }; este cliente los
 * relanza como Error con esa misma propiedad code para que el llamador decida el mensaje.
 *
 * @param {Buffer} buffer
 * @param {{ fileName?: string, maxBytes?: number, maxFilas?: number }} opts
 * @returns {Promise<{ sheetName: string, headers: string[], rows: object[] }>}
 */
async function parsearExcel(buffer, opts = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('EXCEL_SIN_DATOS');
    e.code = 'EXCEL_SIN_DATOS';
    throw e;
  }

  const FormData = require('form-data');
  const form = new FormData();
  form.append('file', buffer, {
    filename: opts.fileName || 'upload.xlsx',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  if (opts.maxBytes) form.append('maxBytes', String(opts.maxBytes));
  if (opts.maxFilas) form.append('maxFilas', String(opts.maxFilas));

  const res = await axios.post(excelParseUrl(), form, {
    headers: form.getHeaders(),
    timeout: TIMEOUT_MS,
    validateStatus: () => true,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  if (res.status >= 200 && res.status < 300) {
    return res.data;
  }

  const data = res.data || {};
  const e = new Error(data.error || `pdf-backend HTTP ${res.status}`);
  if (data.code) {
    e.code = data.code;
  } else if (res.status === 413) {
    e.code = 'ARCHIVO_DEMASIADO_GRANDE';
  }
  throw e;
}

function isConfigured() {
  return Boolean(BASE_URL);
}

module.exports = {
  generarPdfComprobanteVenta,
  generarExcel,
  parsearExcel,
  isConfigured
};
