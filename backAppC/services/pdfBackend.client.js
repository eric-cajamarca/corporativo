const axios = require('axios');

const BASE_URL = (process.env.PDF_BACKEND_URL || 'http://127.0.0.1:3002').replace(/\/$/, '');
const TIMEOUT_MS = Number(process.env.PDF_BACKEND_TIMEOUT_MS) || 90000;

function reportsUrl() {
  return `${BASE_URL}/api/reports/generate-pdf`;
}

/**
 * Genera PDF de comprobante/cotización vía pdf-backend.
 * @returns {Promise<Buffer>}
 */
async function generarPdfComprobanteVenta(datos, formato = 'A4') {
  const res = await axios.post(
    reportsUrl(),
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

function isConfigured() {
  return Boolean(BASE_URL);
}

module.exports = { generarPdfComprobanteVenta, isConfigured };
