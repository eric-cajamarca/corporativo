const ExcelJS = require('exceljs');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILAS = 4000;

/**
 * ExcelJS devuelve celdas como objetos para fórmulas, hipervínculos, fechas o
 * texto enriquecido. Esta utilidad las normaliza a string plano.
 */
function celdaACadena(value) {
  if (value == null) return '';
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'object') {
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text || '').join('');
    }
    if (value.text != null) {
      return String(value.text);
    }
    if (value.result != null) {
      return celdaACadena(value.result);
    }
    if (value.hyperlink && value.text == null) {
      return String(value.hyperlink);
    }
    return '';
  }
  return String(value);
}

/**
 * Parsea un buffer xlsx a { headers, rows }. La fila 1 se considera encabezado.
 * Cada elemento de rows es un objeto { [header]: stringValue }, omitiendo filas totalmente vacías.
 *
 * Errores conocidos (string en error.code):
 *   ARCHIVO_DEMASIADO_GRANDE | EXCEL_SIN_HOJAS | EXCEL_SIN_DATOS | DEMASIADAS_FILAS | EXCEL_INVALIDO
 */
async function parsearXlsxBuffer(buffer, opts = {}) {
  const maxBytes = Number.isFinite(opts.maxBytes) ? opts.maxBytes : MAX_BYTES;
  const maxFilas = Number.isFinite(opts.maxFilas) ? opts.maxFilas : MAX_FILAS;

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const e = new Error('EXCEL_SIN_DATOS');
    e.code = 'EXCEL_SIN_DATOS';
    throw e;
  }
  if (buffer.length > maxBytes) {
    const e = new Error('ARCHIVO_DEMASIADO_GRANDE');
    e.code = 'ARCHIVO_DEMASIADO_GRANDE';
    throw e;
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (cause) {
    const e = new Error('EXCEL_INVALIDO');
    e.code = 'EXCEL_INVALIDO';
    e.cause = cause;
    throw e;
  }

  const sheet = wb.worksheets[0];
  if (!sheet) {
    const e = new Error('EXCEL_SIN_HOJAS');
    e.code = 'EXCEL_SIN_HOJAS';
    throw e;
  }

  const headerRow = sheet.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    headers[colNum] = celdaACadena(cell.value);
  });
  const tieneEncabezados = headers.some((h) => h && String(h).trim() !== '');
  if (!tieneEncabezados) {
    const e = new Error('EXCEL_SIN_DATOS');
    e.code = 'EXCEL_SIN_DATOS';
    throw e;
  }

  const rows = [];
  const ultimaFila = sheet.actualRowCount;
  for (let r = 2; r <= ultimaFila; r += 1) {
    const row = sheet.getRow(r);
    const obj = {};
    let filaVacia = true;
    for (let c = 1; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) continue;
      const valor = celdaACadena(row.getCell(c).value).trim();
      if (valor !== '') filaVacia = false;
      obj[header] = valor;
    }
    if (filaVacia) continue;

    rows.push(obj);
    if (rows.length > maxFilas) {
      const e = new Error('DEMASIADAS_FILAS');
      e.code = 'DEMASIADAS_FILAS';
      throw e;
    }
  }

  if (rows.length === 0) {
    const e = new Error('EXCEL_SIN_DATOS');
    e.code = 'EXCEL_SIN_DATOS';
    throw e;
  }

  const headersLimpios = headers
    .filter((h, i) => i > 0 && h && String(h).trim() !== '')
    .map((h) => String(h));

  return {
    sheetName: sheet.name,
    headers: headersLimpios,
    rows
  };
}

module.exports = {
  parsearXlsxBuffer,
  MAX_BYTES,
  MAX_FILAS
};
