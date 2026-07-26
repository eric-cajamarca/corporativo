const ExcelJS = require('exceljs');

const TOTAL_COLS = 14;
const COLOR_TITULO = 'FF1F4E79';
const COLOR_HEADER = 'FF2E75B6';
const COLOR_TOTAL = 'FF2E75B6';
const COLOR_META = 'FFF2F2F2';
const COLOR_ZEBRA = 'FFF8FAFC';

function relleno(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function fmtFechaPeriodo(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function num(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

function blankIfZero(val) {
  const n = num(val);
  return Math.abs(n) < 0.0000001 ? '' : n;
}

function pintarRango(row, fromCol, toCol, argb) {
  for (let c = fromCol; c <= toCol; c += 1) {
    row.getCell(c).fill = relleno(argb);
  }
}

function estiloHeaderCelda(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  cell.fill = relleno(COLOR_HEADER);
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FF1F4E79' } },
    bottom: { style: 'thin', color: { argb: 'FF1F4E79' } },
    left: { style: 'thin', color: { argb: 'FF1F4E79' } },
    right: { style: 'thin', color: { argb: 'FF1F4E79' } },
  };
}

function bordeCelda(cell) {
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
    right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  };
}

function fmtCantidad(cell) {
  cell.numFmt = '#,##0.000';
  cell.alignment = { horizontal: 'right' };
}

function fmtImporte(cell) {
  cell.numFmt = '#,##0.00';
  cell.alignment = { horizontal: 'right' };
}

/**
 * FORMATO 13.1 — Registro de Inventario Permanente Valorizado
 */
async function generateExcelKardex131(data) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Formato 13.1');

  const empresa = data.empresa || {};
  const periodo = data.periodo || {};
  const productos = Array.isArray(data.productos) ? data.productos : [];
  const fechaDesde = fmtFechaPeriodo(periodo.fechaDesde);
  const fechaHasta = fmtFechaPeriodo(periodo.fechaHasta);

  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const rTitulo = ws.getRow(1);
  rTitulo.getCell(1).value =
    'FORMATO 13.1 REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DE INVENTARIO VALORIZADO';
  rTitulo.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  rTitulo.getCell(1).fill = relleno(COLOR_TITULO);
  rTitulo.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  rTitulo.height = 30;

  const addMeta = (label, value) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
    ws.mergeCells(row.number, 2, row.number, TOTAL_COLS);
    pintarRango(row, 1, TOTAL_COLS, COLOR_META);
    return row;
  };

  addMeta('PERIODO:', `${fechaDesde} AL ${fechaHasta}`);
  addMeta('RUC:', empresa.ruc || '');
  addMeta('RAZON SOCIAL:', empresa.razonSocial || empresa.nombre || '');
  addMeta('ESTABLECIMIENTO:', empresa.establecimiento || 'ALMACEN GENERAL');
  ws.addRow([]);

  if (productos.length === 0) {
    ws.addRow(['No hay productos con movimientos o saldo en el periodo seleccionado.']);
    ws.getColumn(1).width = 22;
    return workbook.xlsx.writeBuffer();
  }

  for (let i = 0; i < productos.length; i += 1) {
    const prod = productos[i];
    if (i > 0) ws.addRow([]);

    const tipoTxt = `${prod.tipoExistencia || '01'} ${prod.tipoExistenciaDescripcion || 'MERCADERIAS'}`;

    const rCod = ws.addRow(['CODIGO DE EXISTENCIA:', prod.codigo || '', '', 'TIPO:', tipoTxt]);
    rCod.getCell(1).font = { bold: true, size: 9 };
    rCod.getCell(4).font = { bold: true, size: 9 };
    ws.mergeCells(rCod.number, 2, rCod.number, 3);
    ws.mergeCells(rCod.number, 5, rCod.number, TOTAL_COLS);

    const rDesc = ws.addRow([
      'DESCRIPCION:',
      prod.descripcion || '',
      '',
      '',
      '',
      '',
      'UNIDAD DE MEDIDA:',
      prod.unidadMedida || 'NIU',
    ]);
    rDesc.getCell(1).font = { bold: true, size: 9 };
    rDesc.getCell(7).font = { bold: true, size: 9 };
    ws.mergeCells(rDesc.number, 2, rDesc.number, 6);
    ws.mergeCells(rDesc.number, 8, rDesc.number, TOTAL_COLS);

    const h1 = ws.addRow([
      'DOCUMENTO DE TRASLADO, COMPROBANTE DE PAGO, DOCUMENTO INTERNO O',
      '',
      '',
      '',
      'TIPO DE OPERACION (TABLA 12)',
      'ENTRADAS',
      '',
      '',
      'SALIDAS',
      '',
      '',
      'SALDO FINAL',
      '',
      '',
    ]);
    ws.mergeCells(h1.number, 1, h1.number, 4);
    ws.mergeCells(h1.number, 6, h1.number, 8);
    ws.mergeCells(h1.number, 9, h1.number, 11);
    ws.mergeCells(h1.number, 12, h1.number, 14);
    for (let c = 1; c <= TOTAL_COLS; c += 1) estiloHeaderCelda(h1.getCell(c));
    h1.height = 22;

    const h2 = ws.addRow([
      'FECHA',
      'TIPO',
      'SERIE',
      'NUMERO',
      '',
      'CANTIDAD',
      'C. UNITARIO',
      'IMPORTE S/.',
      'CANTIDAD',
      'C. UNITARIO',
      'IMPORTE S/.',
      'CANTIDAD',
      'C. UNITARIO',
      'IMPORTE S/.',
    ]);
    for (let c = 1; c <= TOTAL_COLS; c += 1) estiloHeaderCelda(h2.getCell(c));
    h2.height = 20;

    (prod.filas || []).forEach((f, idx) => {
      const row = ws.addRow([
        f.fecha || '',
        f.tipoDocumento || '',
        f.serie || '',
        f.numero || '',
        f.tipoOperacion || '',
        blankIfZero(f.cantidadEntrada),
        blankIfZero(f.costoUnitarioEntrada),
        blankIfZero(f.importeEntrada),
        blankIfZero(f.cantidadSalida),
        blankIfZero(f.costoUnitarioSalida),
        blankIfZero(f.importeSalida),
        num(f.saldoCantidad),
        num(f.saldoCostoUnitario),
        num(f.saldoImporte),
      ]);

      [6, 9, 12].forEach((c) => {
        if (row.getCell(c).value !== '') fmtCantidad(row.getCell(c));
      });
      [7, 8, 10, 11, 13, 14].forEach((c) => {
        if (row.getCell(c).value !== '') fmtImporte(row.getCell(c));
      });
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(5).alignment = { horizontal: 'center' };
      for (let c = 1; c <= TOTAL_COLS; c += 1) {
        bordeCelda(row.getCell(c));
        if (idx % 2 === 0) row.getCell(c).fill = relleno(COLOR_ZEBRA);
      }
    });

    const tot = prod.totales || {};
    const rTot = ws.addRow([
      'TOTAL:',
      '',
      '',
      '',
      '',
      num(tot.totalEntradaCantidad),
      '',
      num(tot.totalEntradaImporte),
      num(tot.totalSalidaCantidad),
      '',
      num(tot.totalSalidaImporte),
      num(tot.saldoFinalCantidad),
      num(tot.saldoFinalCostoUnitario),
      num(tot.saldoFinalImporte),
    ]);
    ws.mergeCells(rTot.number, 1, rTot.number, 5);
    rTot.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    for (let c = 1; c <= TOTAL_COLS; c += 1) {
      rTot.getCell(c).fill = relleno(COLOR_TOTAL);
      rTot.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      bordeCelda(rTot.getCell(c));
    }
    fmtCantidad(rTot.getCell(6));
    fmtImporte(rTot.getCell(8));
    fmtCantidad(rTot.getCell(9));
    fmtImporte(rTot.getCell(11));
    fmtCantidad(rTot.getCell(12));
    fmtImporte(rTot.getCell(13));
    fmtImporte(rTot.getCell(14));
  }

  const widths = [12, 8, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12];
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });
    ws.getColumn(1).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 20;

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelKardex131 };
