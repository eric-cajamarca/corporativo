const { parsearXlsxBuffer, MAX_BYTES, MAX_FILAS } = require('../services/excelParse.service');
const { extraerTextoPdfBuffer } = require('../services/pdfParse.service');
const {
  normalizarFilasExcel,
  normalizarTextoPdf
} = require('../services/listRowsNormalize.service');

const CODIGOS_400 = new Set([
  'ARCHIVO_DEMASIADO_GRANDE',
  'EXCEL_SIN_HOJAS',
  'EXCEL_SIN_DATOS',
  'DEMASIADAS_FILAS',
  'EXCEL_INVALIDO',
  'PDF_SIN_DATOS',
  'PDF_INVALIDO',
  'PDF_SIN_TEXTO',
  'ARCHIVO_REQUERIDO',
  'TIPO_ARCHIVO_NO_SOPORTADO'
]);

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MIME_PDF = 'application/pdf';

function extensionDeArchivo(name) {
  const n = String(name || '').toLowerCase();
  const idx = n.lastIndexOf('.');
  return idx >= 0 ? n.slice(idx + 1) : '';
}

function detectarTipo(file) {
  const ext = extensionDeArchivo(file.originalname);
  const mime = String(file.mimetype || '').toLowerCase();
  if (ext === 'xlsx' || mime === MIME_XLSX) return 'excel';
  if (ext === 'pdf' || mime === MIME_PDF) return 'pdf';
  return null;
}

async function parseList(req, res) {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        error: 'Adjunte un archivo .xlsx o .pdf en el campo "file"',
        code: 'ARCHIVO_REQUERIDO'
      });
    }

    const tipo = detectarTipo(req.file);
    if (!tipo) {
      return res.status(400).json({
        error: 'Solo se admiten archivos Excel (.xlsx) o PDF con texto',
        code: 'TIPO_ARCHIVO_NO_SOPORTADO'
      });
    }

    const opts = {};
    if (req.body?.maxBytes) {
      const n = Number(req.body.maxBytes);
      if (Number.isFinite(n) && n > 0) opts.maxBytes = n;
    }
    if (req.body?.maxFilas) {
      const n = Number(req.body.maxFilas);
      if (Number.isFinite(n) && n > 0) opts.maxFilas = n;
    }

    if (tipo === 'excel') {
      const parsed = await parsearXlsxBuffer(req.file.buffer, opts);
      const items = normalizarFilasExcel(parsed.headers, parsed.rows);
      if (!items.length) {
        return res.status(400).json({ error: 'No se encontraron productos en el Excel', code: 'EXCEL_SIN_DATOS' });
      }
      return res.status(200).json({
        source: 'excel',
        sheetName: parsed.sheetName,
        headers: parsed.headers,
        items,
        totalItems: items.length
      });
    }

    const pdf = await extraerTextoPdfBuffer(req.file.buffer, opts);
    const items = normalizarTextoPdf(pdf.text);
    if (!items.length) {
      return res.status(400).json({
        error: 'No se pudieron detectar líneas de productos en el PDF',
        code: 'PDF_SIN_TEXTO'
      });
    }
  if (items.length > (opts.maxFilas || MAX_FILAS)) {
      return res.status(400).json({ error: 'Demasiadas filas en el archivo', code: 'DEMASIADAS_FILAS' });
    }

    return res.status(200).json({
      source: 'pdf',
      numPages: pdf.numPages,
      textPreview: pdf.text.slice(0, 400),
      items,
      totalItems: items.length
    });
  } catch (error) {
    if (error && CODIGOS_400.has(error.code)) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('contexto: parseList', error);
    return res.status(500).json({ error: 'Error al procesar el archivo', code: 'INTERNAL' });
  }
}

module.exports = { parseList, MAX_BYTES, MAX_FILAS };
