/**
 * Normaliza filas de Excel o líneas de PDF a items de cotización:
 * { linea, descripcion, cantidad, codigo?, unidad?, raw? }
 */

const CLAVE_DESCRIPCION = new Set([
  'producto',
  'descripcion',
  'descripcionproducto',
  'nombre',
  'articulo',
  'item',
  'detalle',
  'nombreproducto',
  'productodescripcion'
]);

const CLAVE_CANTIDAD = new Set(['cantidad', 'cant', 'qty', 'q', 'unidades', 'cantidadpedida', 'cantpedida']);

const CLAVE_CODIGO = new Set(['codigo', 'sku', 'cod', 'referencia', 'codproducto', 'codigoproducto']);

const CLAVE_UNIDAD = new Set(['unidad', 'um', 'medida', 'presentacion', 'umedida', 'unidadmedida']);

const PREFIJO_DESCRIPCION = ['descrip', 'product', 'articul', 'nombre', 'item', 'detalle'];
const PREFIJO_CANTIDAD = ['cantid', 'qty', 'cant'];
const PREFIJO_CODIGO = ['codig', 'sku', 'refer'];
const PREFIJO_UNIDAD = ['umed', 'unid', 'medid', 'present'];

const UNIDADES_PDF_REGEX =
  '(?:pieza|piezas|unidad|unidades|und|kg|lt|l|ml|caja|paq|rollo|metro|metros|m)';

function normalizarClave(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function parseCantidad(val) {
  const s = String(val ?? '')
    .trim()
    .replace(',', '.');
  if (!s) return 1;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

function elegirCampo(mapaNorm, clavesSet, prefijos = []) {
  for (const [k, v] of Object.entries(mapaNorm)) {
    if (clavesSet.has(k) && String(v || '').trim() !== '') {
      return String(v).trim();
    }
  }
  for (const [k, v] of Object.entries(mapaNorm)) {
    if (!String(v || '').trim()) continue;
    for (const pref of prefijos) {
      if (k.includes(pref)) return String(v).trim();
    }
  }
  return '';
}

/**
 * PDF exportado desde Excel suele pegar columnas: "ProductoPieza1090" → qty 10, resto precio.
 */
function splitCantidadPrecioConcat(digitStr) {
  const s = String(digitStr || '').replace(/\D/g, '');
  if (!s) return { cantidad: 1 };
  if (s.length <= 2) {
    const q = parseCantidad(s);
    return { cantidad: q || 1 };
  }

  const candidatos = [];
  for (let i = 1; i < s.length; i += 1) {
    const q = parseCantidad(s.slice(0, i));
    const rest = s.slice(i);
    if (q != null && q > 0 && q <= 9999 && rest.length > 0) {
      candidatos.push({ cantidad: q, restLen: rest.length });
    }
  }
  if (!candidatos.length) {
    const q = parseCantidad(s);
    return { cantidad: q || 1 };
  }
  candidatos.sort((a, b) => {
    const scoreOf = (c) =>
      (c.cantidad <= 999 ? 3 : 0) +
      (c.restLen >= 1 && c.restLen <= 5 ? 2 : 0) +
      (c.cantidad >= 2 && c.cantidad <= 500 ? 1 : 0);
    return scoreOf(b) - scoreOf(a);
  });
  return { cantidad: candidatos[0].cantidad };
}

function filaExcelAItem(row, linea) {
  const mapaNorm = {};
  for (const [k, v] of Object.entries(row || {})) {
    mapaNorm[normalizarClave(k)] = v;
  }

  let descripcion = elegirCampo(mapaNorm, CLAVE_DESCRIPCION, PREFIJO_DESCRIPCION);
  const codigo = elegirCampo(mapaNorm, CLAVE_CODIGO, PREFIJO_CODIGO);
  const unidad = elegirCampo(mapaNorm, CLAVE_UNIDAD, PREFIJO_UNIDAD);
  let cantidad = parseCantidad(elegirCampo(mapaNorm, CLAVE_CANTIDAD, PREFIJO_CANTIDAD));

  if (!descripcion && codigo) descripcion = codigo;
  if (!descripcion) {
    const valores = Object.values(mapaNorm).map((x) => String(x || '').trim()).filter(Boolean);
    descripcion = valores[0] || '';
    if (valores.length > 1 && cantidad == null) {
      const posibleQty = parseCantidad(valores[valores.length - 1]);
      if (posibleQty != null && valores.length >= 2) {
        cantidad = posibleQty;
        descripcion = valores.slice(0, -1).join(' ');
      }
    }
  }

  if (!descripcion) return null;
  if (cantidad == null) cantidad = 1;

  return {
    linea,
    descripcion,
    cantidad,
    codigo: codigo || null,
    unidad: unidad || null,
    raw: row
  };
}

function normalizarFilasExcel(headers, rows) {
  const items = [];
  let linea = 0;
  for (const row of rows || []) {
    linea += 1;
    const item = filaExcelAItem(row, linea);
    if (item) items.push(item);
  }
  return items;
}

function lineaPareceEncabezado(linea) {
  const l = String(linea || '').toLowerCase().replace(/\s/g, '');
  if (l.length > 120) return false;
  if (/descripcion.*cantidad|cantidad.*precio|descripcion.*umedida|producto.*cantidad/.test(l)) {
    return true;
  }
  if (/^(producto|descripcion|articulo|cantidad|codigo|item|umedida)\b/i.test(linea) && linea.length < 80) {
    return true;
  }
  return false;
}

function parseLineaPdfTabla(raw, lineaNum) {
  const line = String(raw || '').trim();
  if (!line || line.length < 3) return null;
  if (lineaPareceEncabezado(line)) return null;

  const reUnidad = new RegExp(`^(.+?)(${UNIDADES_PDF_REGEX})(\\d+)$`, 'i');
  let m = line.match(reUnidad);
  if (m) {
    const descripcion = m[1].trim();
    const { cantidad } = splitCantidadPrecioConcat(m[3]);
    if (descripcion.length >= 2) {
      return {
        linea: lineaNum,
        descripcion,
        cantidad,
        codigo: null,
        unidad: m[2],
        raw: line
      };
    }
  }

  m = line.match(/^(.+?)(\d{2,})$/);
  if (m && m[1].length >= 4 && !/\.\d$/.test(m[1])) {
    const descripcion = m[1].trim();
    const { cantidad } = splitCantidadPrecioConcat(m[2]);
    return {
      linea: lineaNum,
      descripcion,
      cantidad,
      codigo: null,
      unidad: null,
      raw: line
    };
  }

  return parseLineaTexto(line, lineaNum);
}

function parseLineaTexto(linea, lineaNum) {
  const raw = String(linea || '').trim();
  if (!raw || raw.length < 2) return null;
  if (lineaPareceEncabezado(raw)) return null;

  let m = raw.match(/^(\d+)[\.\)]\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*$/);
  if (m) {
    const descripcion = String(m[2]).trim();
    const cantidad = parseCantidad(m[3]);
    if (descripcion && cantidad != null) {
      return { linea: lineaNum, descripcion, cantidad, codigo: null, unidad: null, raw };
    }
  }

  m = raw.match(/^(.+?)\s+x\s*(\d+(?:[.,]\d+)?)\s*$/i);
  if (m) {
    const descripcion = String(m[1]).trim();
    const cantidad = parseCantidad(m[2]);
    if (descripcion && cantidad != null) {
      return { linea: lineaNum, descripcion, cantidad, codigo: null, unidad: null, raw };
    }
  }

  m = raw.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (m) {
    const cantidad = parseCantidad(m[1]);
    const descripcion = String(m[2]).trim();
    if (descripcion && cantidad != null) {
      return { linea: lineaNum, descripcion, cantidad, codigo: null, unidad: null, raw };
    }
  }

  m = raw.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(und|unid|unidades|kg|lt|l|ml|caja|paq)?\s*$/i);
  if (m) {
    const descripcion = String(m[1]).trim();
    const cantidad = parseCantidad(m[2]);
    if (descripcion && cantidad != null) {
      return { linea: lineaNum, descripcion, cantidad, codigo: null, unidad: m[3] || null, raw };
    }
  }

  if (raw.includes('\t')) {
    const cols = raw.split('\t').map((c) => c.trim()).filter(Boolean);
    if (cols.length >= 2) {
      const qty = parseCantidad(cols[cols.length - 1]);
      if (qty != null) {
        return {
          linea: lineaNum,
          descripcion: cols.slice(0, -1).join(' '),
          cantidad: qty,
          codigo: null,
          unidad: null,
          raw
        };
      }
    }
  }

  return {
    linea: lineaNum,
    descripcion: raw,
    cantidad: 1,
    codigo: null,
    unidad: null,
    raw
  };
}

function normalizarTextoPdf(text) {
  const lineas = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items = [];
  let n = 0;
  for (const linea of lineas) {
    n += 1;
    const item = parseLineaPdfTabla(linea, n);
    if (item && !lineaPareceEncabezado(item.descripcion)) items.push(item);
  }
  return items;
}

module.exports = {
  normalizarFilasExcel,
  normalizarTextoPdf,
  normalizarClave
};
