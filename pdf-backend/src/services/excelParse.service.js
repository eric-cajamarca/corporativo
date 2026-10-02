const ExcelJS = require('exceljs');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILAS = 4000;

function esFechaExcel(value) {
  if (value instanceof Date) return true;
  if (value && typeof value === 'object' && value.result instanceof Date) return true;
  return false;
}

function claveEncabezado(k) {
  return String(k || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

/**
 * ExcelJS devuelve celdas como objetos para fórmulas, hipervínculos, fechas o
 * texto enriquecido. Esta utilidad las normaliza a string plano.
 * Fechas → aaaa-mm-dd (no ISO, que rompe códigos de producto).
 * En columna codigo/sku una fecha no es un SKU: se deja vacío.
 */
function celdaACadena(value, opts = {}) {
  if (value == null) return '';
  if (esFechaExcel(value) && opts.esCodigo) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text || '').join('');
    }
    if (value.text != null) {
      return String(value.text);
    }
    if (value.result != null) {
      return celdaACadena(value.result, opts);
    }
    if (value.hyperlink && value.text == null) {
      return String(value.hyperlink);
    }
    return '';
  }
  return String(value);
}

function encabezadosDeFila(sheet, rowNumber) {
  const headerRow = sheet.getRow(rowNumber);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    headers[colNum] = celdaACadena(cell.value).trim();
  });
  return headers;
}

function filaPareceProductos(headers) {
  const norm = headers.map((h) => claveEncabezado(h));
  return norm.includes('codigo') && (norm.includes('descripcion') || norm.includes('nombreproducto'));
}

/** Prefiere la hoja Productos (codigo + descripcion). Si no hay, usa la primera. */
function localizarHoja(wb) {
  for (const sheet of wb.worksheets || []) {
    const tope = Math.min(3, sheet.rowCount || 3);
    for (let r = 1; r <= tope; r += 1) {
      const headers = encabezadosDeFila(sheet, r);
      if (filaPareceProductos(headers)) {
        return { sheet, headerRow: r, headers };
      }
    }
  }
  const sheet = wb.worksheets[0];
  if (!sheet) return null;
  return { sheet, headerRow: 1, headers: encabezadosDeFila(sheet, 1) };
}

/**
 * Parsea un buffer xlsx a { headers, rows }.
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

  if (!wb.worksheets || wb.worksheets.length === 0) {
    const e = new Error('EXCEL_SIN_HOJAS');
    e.code = 'EXCEL_SIN_HOJAS';
    throw e;
  }

  const ubicada = localizarHoja(wb);
  if (!ubicada) {
    const e = new Error('EXCEL_SIN_HOJAS');
    e.code = 'EXCEL_SIN_HOJAS';
    throw e;
  }

  const { sheet, headerRow, headers } = ubicada;
  const tieneEncabezados = headers.some((h) => h && String(h).trim() !== '');
  if (!tieneEncabezados) {
    const e = new Error('EXCEL_SIN_DATOS');
    e.code = 'EXCEL_SIN_DATOS';
    throw e;
  }

  const rows = [];
  const ultimaFila = Math.max(sheet.actualRowCount || headerRow, headerRow);
  for (let r = headerRow + 1; r <= ultimaFila; r += 1) {
    const row = sheet.getRow(r);
    const obj = {};
    let filaVacia = true;
    for (let c = 1; c < headers.length; c += 1) {
      const header = headers[c];
      if (!header) continue;
      const clave = claveEncabezado(header);
      const valor = celdaACadena(row.getCell(c).value, {
        esCodigo: clave === 'codigo' || clave === 'sku'
      }).trim();
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
