const ExcelJS = require('exceljs');

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
 * FORMATO 13.1 o libro DIGEMID de controlados.
 */
async function generateExcelKardex131(data) {
  const workbook = new ExcelJS.Workbook();
  const esDigemid = String(data.tipoLibro || '').toUpperCase() === 'DIGEMID';
  const extraCols = esDigemid ? 4 : 0;
  const totalCols = 14 + extraCols;
  const colOp = 5;
  const colRecetaIni = esDigemid ? 6 : 0;
  const colEntrada = 6 + extraCols;
  const colSalida = 9 + extraCols;
  const colSaldo = 12 + extraCols;

  const ws = workbook.addWorksheet(esDigemid ? 'DIGEMID controlados' : 'Formato 13.1');

  const empresa = data.empresa || {};
  const periodo = data.periodo || {};
  const productos = Array.isArray(data.productos) ? data.productos : [];
  const fechaDesde = fmtFechaPeriodo(periodo.fechaDesde);
  const fechaHasta = fmtFechaPeriodo(periodo.fechaHasta);

  ws.mergeCells(1, 1, 1, totalCols);
  const rTitulo = ws.getRow(1);
  rTitulo.getCell(1).value = esDigemid
    ? 'LIBRO DE CONTROL DE PSICOTRÓPICOS Y SUSTANCIAS CONTROLADAS (DIGEMID)'
    : 'FORMATO 13.1 REGISTRO DE INVENTARIO PERMANENTE VALORIZADO - DETALLE DE INVENTARIO VALORIZADO';
  rTitulo.getCell(1).font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
  rTitulo.getCell(1).fill = relleno(COLOR_TITULO);
  rTitulo.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  rTitulo.height = 30;

  const addMeta = (label, value) => {
    const row = ws.addRow([label, value]);
    row.getCell(1).font = { bold: true, size: 10 };
    row.getCell(2).font = { size: 10 };
    ws.mergeCells(row.number, 2, row.number, totalCols);
    pintarRango(row, 1, totalCols, COLOR_META);
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
    ws.mergeCells(rCod.number, 5, rCod.number, totalCols);

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
    ws.mergeCells(rDesc.number, 8, rDesc.number, totalCols);

    if (esDigemid) {
      const ficha = [
        prod.principioActivo || '—',
        prod.concentracion || '',
        prod.formaFarmaceutica || '',
      ].filter(Boolean).join(' · ');
      const lab = [
        prod.marca || '—',
        prod.registroSanitario ? `RS: ${prod.registroSanitario}` : '',
      ].filter(Boolean).join(' · ');
      const rFar = ws.addRow(['PRINCIPIO ACTIVO:', ficha, '', 'MARCA / LAB.:', lab]);
      rFar.getCell(1).font = { bold: true, size: 9 };
      rFar.getCell(4).font = { bold: true, size: 9 };
      ws.mergeCells(rFar.number, 2, rFar.number, 3);
      ws.mergeCells(rFar.number, 5, rFar.number, totalCols);
    }

    const h1Vals = new Array(totalCols).fill('');
    h1Vals[0] = 'DOCUMENTO DE TRASLADO, COMPROBANTE DE PAGO, DOCUMENTO INTERNO O';
    h1Vals[colOp - 1] = 'TIPO DE OPERACION (TABLA 12)';
    if (esDigemid) {
      h1Vals[colRecetaIni - 1] = 'PACIENTE';
      h1Vals[colRecetaIni] = 'MEDICO';
      h1Vals[colRecetaIni + 1] = 'CMP';
      h1Vals[colRecetaIni + 2] = 'N° RECETA';
    }
    h1Vals[colEntrada - 1] = 'ENTRADAS';
    h1Vals[colSalida - 1] = 'SALIDAS';
    h1Vals[colSaldo - 1] = 'SALDO FINAL';
    const h1 = ws.addRow(h1Vals);
    ws.mergeCells(h1.number, 1, h1.number, 4);
    ws.mergeCells(h1.number, colEntrada, h1.number, colEntrada + 2);
    ws.mergeCells(h1.number, colSalida, h1.number, colSalida + 2);
    ws.mergeCells(h1.number, colSaldo, h1.number, colSaldo + 2);
    for (let c = 1; c <= totalCols; c += 1) estiloHeaderCelda(h1.getCell(c));
    h1.height = 22;

    const h2Vals = new Array(totalCols).fill('');
    h2Vals[0] = 'FECHA';
    h2Vals[1] = 'TIPO';
    h2Vals[2] = 'SERIE';
    h2Vals[3] = 'NUMERO';
    h2Vals[colEntrada - 1] = 'CANTIDAD';
    h2Vals[colEntrada] = 'C. UNITARIO';
    h2Vals[colEntrada + 1] = 'IMPORTE S/.';
    h2Vals[colSalida - 1] = 'CANTIDAD';
    h2Vals[colSalida] = 'C. UNITARIO';
    h2Vals[colSalida + 1] = 'IMPORTE S/.';
    h2Vals[colSaldo - 1] = 'CANTIDAD';
    h2Vals[colSaldo] = 'C. UNITARIO';
    h2Vals[colSaldo + 1] = 'IMPORTE S/.';
    const h2 = ws.addRow(h2Vals);
    for (let c = 1; c <= totalCols; c += 1) estiloHeaderCelda(h2.getCell(c));
    h2.height = 20;

    (prod.filas || []).forEach((f, idx) => {
      const vals = new Array(totalCols).fill('');
      vals[0] = f.fecha || '';
      vals[1] = f.tipoDocumento || '';
      vals[2] = f.serie || '';
      vals[3] = f.numero || '';
      vals[colOp - 1] = f.tipoOperacion || '';
      if (esDigemid) {
        vals[colRecetaIni - 1] = f.pacienteNombre || '';
        vals[colRecetaIni] = f.medicoNombre || '';
        vals[colRecetaIni + 1] = f.cmp || '';
        vals[colRecetaIni + 2] = f.numeroReceta || '';
      }
      vals[colEntrada - 1] = blankIfZero(f.cantidadEntrada);
      vals[colEntrada] = blankIfZero(f.costoUnitarioEntrada);
      vals[colEntrada + 1] = blankIfZero(f.importeEntrada);
      vals[colSalida - 1] = blankIfZero(f.cantidadSalida);
      vals[colSalida] = blankIfZero(f.costoUnitarioSalida);
      vals[colSalida + 1] = blankIfZero(f.importeSalida);
      vals[colSaldo - 1] = num(f.saldoCantidad);
      vals[colSaldo] = num(f.saldoCostoUnitario);
      vals[colSaldo + 1] = num(f.saldoImporte);
      const row = ws.addRow(vals);

      [colEntrada, colSalida, colSaldo].forEach((c) => {
        if (row.getCell(c).value !== '') fmtCantidad(row.getCell(c));
      });
      [colEntrada + 1, colEntrada + 2, colSalida + 1, colSalida + 2, colSaldo + 1, colSaldo + 2].forEach((c) => {
        if (row.getCell(c).value !== '') fmtImporte(row.getCell(c));
      });
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(colOp).alignment = { horizontal: 'center' };
      for (let c = 1; c <= totalCols; c += 1) {
        bordeCelda(row.getCell(c));
        if (idx % 2 === 0) row.getCell(c).fill = relleno(COLOR_ZEBRA);
      }
    });

    const tot = prod.totales || {};
    const totVals = new Array(totalCols).fill('');
    totVals[0] = 'TOTAL:';
    totVals[colEntrada - 1] = num(tot.totalEntradaCantidad);
    totVals[colEntrada + 1] = num(tot.totalEntradaImporte);
    totVals[colSalida - 1] = num(tot.totalSalidaCantidad);
    totVals[colSalida + 1] = num(tot.totalSalidaImporte);
    totVals[colSaldo - 1] = num(tot.saldoFinalCantidad);
    totVals[colSaldo] = num(tot.saldoFinalCostoUnitario);
    totVals[colSaldo + 1] = num(tot.saldoFinalImporte);
    const rTot = ws.addRow(totVals);
    ws.mergeCells(rTot.number, 1, rTot.number, colOp + extraCols);
    rTot.getCell(1).alignment = { horizontal: 'right', vertical: 'middle' };
    for (let c = 1; c <= totalCols; c += 1) {
      rTot.getCell(c).fill = relleno(COLOR_TOTAL);
      rTot.getCell(c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      bordeCelda(rTot.getCell(c));
    }
    fmtCantidad(rTot.getCell(colEntrada));
    fmtImporte(rTot.getCell(colEntrada + 2));
    fmtCantidad(rTot.getCell(colSalida));
    fmtImporte(rTot.getCell(colSalida + 2));
    fmtCantidad(rTot.getCell(colSaldo));
    fmtImporte(rTot.getCell(colSaldo + 1));
    fmtImporte(rTot.getCell(colSaldo + 2));
  }

  const widths = new Array(totalCols).fill(12);
  widths[0] = 14;
  widths[1] = 8;
  widths[2] = 10;
  widths[3] = 14;
  widths[4] = 20;
  if (esDigemid) {
    widths[5] = 22;
    widths[6] = 22;
    widths[7] = 10;
    widths[8] = 14;
  }
  widths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelKardex131 };
