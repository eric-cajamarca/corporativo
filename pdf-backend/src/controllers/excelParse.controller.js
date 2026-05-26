const { parsearXlsxBuffer, MAX_BYTES, MAX_FILAS } = require('../services/excelParse.service');

const CODIGOS_400 = new Set([
  'ARCHIVO_DEMASIADO_GRANDE',
  'EXCEL_SIN_HOJAS',
  'EXCEL_SIN_DATOS',
  'DEMASIADAS_FILAS',
  'EXCEL_INVALIDO'
]);

async function parseExcel(req, res) {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        error: 'Adjunte un archivo Excel (.xlsx) en el campo "file"',
        code: 'ARCHIVO_REQUERIDO'
      });
    }

    const opts = {};
    if (req.body && req.body.maxBytes) {
      const n = Number(req.body.maxBytes);
      if (Number.isFinite(n) && n > 0) opts.maxBytes = n;
    }
    if (req.body && req.body.maxFilas) {
      const n = Number(req.body.maxFilas);
      if (Number.isFinite(n) && n > 0) opts.maxFilas = n;
    }

    const data = await parsearXlsxBuffer(req.file.buffer, opts);
    return res.status(200).json(data);
  } catch (error) {
    if (error && CODIGOS_400.has(error.code)) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('contexto: parseExcel', error);
    return res.status(500).json({ error: 'Error al procesar el Excel', code: 'INTERNAL' });
  }
}

module.exports = { parseExcel, MAX_BYTES, MAX_FILAS };
