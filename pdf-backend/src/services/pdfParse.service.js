const pdfParse = require('pdf-parse');

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_TEXTO_CHARS = 12;

function assertPdfMagic(buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.slice(0, 5).toString('ascii') === '%PDF-';
}

/**
 * Extrae texto de un PDF con capa de texto (no OCR).
 */
async function extraerTextoPdfBuffer(buffer, opts = {}) {
  const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : MAX_BYTES;
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('PDF_SIN_DATOS');
    e.code = 'PDF_SIN_DATOS';
    throw e;
  }
  if (buffer.length > maxBytes) {
    const e = new Error('ARCHIVO_DEMASIADO_GRANDE');
    e.code = 'ARCHIVO_DEMASIADO_GRANDE';
    throw e;
  }
  if (!assertPdfMagic(buffer)) {
    const e = new Error('PDF_INVALIDO');
    e.code = 'PDF_INVALIDO';
    throw e;
  }

  let data;
  try {
    data = await pdfParse(buffer, { max: 0 });
  } catch (cause) {
    const e = new Error('PDF_INVALIDO');
    e.code = 'PDF_INVALIDO';
    e.cause = cause;
    throw e;
  }

  const text = String(data?.text || '')
    .replace(/\u0000/g, '')
    .trim();

  if (text.length < MIN_TEXTO_CHARS) {
    const e = new Error('PDF_SIN_TEXTO');
    e.code = 'PDF_SIN_TEXTO';
    throw e;
  }

  return {
    text,
    numPages: data.numpages || data.numPages || null
  };
}

module.exports = {
  extraerTextoPdfBuffer,
  assertPdfMagic,
  MAX_BYTES
};
