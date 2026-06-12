const ExcelJS = require('exceljs');

const COLS = 5;
const COLOR_BORDE = 'FF0056B3';
const COLOR_CABECERA = 'FFE7F1FB';
const COLOR_TABLA_HEAD = 'FF2C3E50';
const COLOR_ZEBRA = 'FFF8FAFC';
const COLOR_TOTALES = 'FFEDF2F7';

function fmtFechaReporte(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function numFmt(cell) {
  cell.numFmt = '#,##0.00';
}

function relleno(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

/** Aplica marco y fondo a un bloque de comprobante (filas start..end, columnas 1..COLS). */
function estilizarBloqueComprobante(ws, startRow, endRow) {
  for (let r = startRow; r <= endRow; r += 1) {
    const row = ws.getRow(r);
    for (let c = 1; c <= COLS; c += 1) {
      const cell = row.getCell(c);
      const esPrimera = r === startRow;
      const esUltima = r === endRow;
      const esPrimeraCol = c === 1;
      const esUltimaCol = c === COLS;

      cell.border = {
        top: { style: esPrimera ? 'medium' : 'thin', color: { argb: COLOR_BORDE } },
        bottom: { style: esUltima ? 'medium' : 'thin', color: { argb: COLOR_BORDE } },
        left: { style: esPrimeraCol ? 'medium' : 'thin', color: { argb: COLOR_BORDE } },
        right: { style: esUltimaCol ? 'medium' : 'thin', color: { argb: COLOR_BORDE } },
      };
    }
  }
}

function pintarFila(row, argb, cols = COLS) {
  for (let c = 1; c <= cols; c += 1) {
    row.getCell(c).fill = relleno(argb);
  }
}

/**
 * Reporte detallado en una sola hoja (misma secuencia que el PDF).
 * Cada comprobante va en un bloque con marco y colores diferenciados.
 */
async function generateExcelDetalleUnaHoja(data, config) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Sheet1');
  const empresa = data.empresa || {};
  const fechaInicio = data.fechaInicio || '';
  const fechaFin = data.fechaFin || '';
  const comprobantes = Array.isArray(data.comprobantes) ? data.comprobantes : [];
  const totales = data.totales || {};
  const etiquetaTercero = config.etiquetaTercero || 'PROVEEDOR';
  const campoTercero = config.campoTercero || 'proveedor';
  const titulo = config.titulo || 'REPORTE DETALLADO';
  const tituloDetalle = config.tituloDetalle || 'DETALLE';
  const sinDatosMsg = config.sinDatosMsg || 'No hay registros en el periodo seleccionado.';

  const bold = { bold: true };
  const titleFont = { bold: true, size: 14 };
  const whiteBold = { bold: true, color: { argb: 'FFFFFFFF' } };

  const addRow = (values) => ws.addRow(values);

  addRow([empresa.nombre || '']);
  addRow([empresa.direccion || '']);
  if (empresa.telefono) addRow([`Tel.: ${empresa.telefono}`]);
  if (empresa.correo) addRow([`Email.: ${empresa.correo}`]);
  addRow([]);

  const rTitulo = addRow([titulo]);
  rTitulo.getCell(1).font = titleFont;
  const rPeriodo = addRow([
    `PERIODO DEL ${fmtFechaReporte(fechaInicio)} DE DEL AL ${fmtFechaReporte(fechaFin)} DE DEL`,
  ]);
  rPeriodo.getCell(1).font = bold;
  addRow([]);

  if (comprobantes.length === 0) {
    addRow([sinDatosMsg]);
    return workbook.xlsx.writeBuffer();
  }

  comprobantes.forEach((comp, idx) => {
    if (idx > 0) {
      addRow([]);
    }

    const blockStartRow = ws.lastRow.number + 1;
    const tercero = comp[campoTercero] || '';

    const r1 = addRow([`${etiquetaTercero} : ${tercero}`, '', '', comp.estado || '', '']);
    r1.getCell(1).font = bold;
    r1.getCell(4).font = bold;
    pintarFila(r1, COLOR_CABECERA);

    const rTotal = addRow([
      `R.U.C. : ${comp.ruc || ''}`,
      '',
      'TOTAL DOCUMENTO S/. :',
      '',
      comp.total ?? 0,
    ]);
    rTotal.getCell(3).font = bold;
    numFmt(rTotal.getCell(5));
    pintarFila(rTotal, COLOR_CABECERA);

    const rDoc = addRow([
      `DOCUMENTO : ${comp.documento || ''}`,
      '',
      'FECHA :',
      '',
      comp.fecha || '',
    ]);
    rDoc.getCell(1).font = bold;
    pintarFila(rDoc, COLOR_CABECERA);

    const rDesc = addRow([tituloDetalle, '', 'DESCUENTO :', '', comp.descuentos ?? 0]);
    rDesc.getCell(1).font = bold;
    numFmt(rDesc.getCell(5));
    pintarFila(rDesc, COLOR_CABECERA);

    const headerRow = addRow(['Codigo', 'Producto', 'Cantidad', 'Precio', 'Importe']);
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber <= COLS) {
        cell.font = whiteBold;
        cell.fill = relleno(COLOR_TABLA_HEAD);
        cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
      }
    });

    (comp.lineas || []).forEach((ln, lineIdx) => {
      const row = addRow([ln.codigo, ln.producto, ln.cantidad, ln.precio, ln.importe]);
      numFmt(row.getCell(4));
      numFmt(row.getCell(5));
      row.getCell(3).alignment = { horizontal: 'right' };
      if (lineIdx % 2 === 0) {
        pintarFila(row, COLOR_ZEBRA);
      }
    });

    const rSub = addRow(['SUB TOTAL:', '', '', '', comp.subTotal ?? 0]);
    rSub.getCell(1).font = bold;
    numFmt(rSub.getCell(5));
    pintarFila(rSub, COLOR_TOTALES);

    const rIgv = addRow(['IGV:', '', '', '', comp.igv ?? 0]);
    rIgv.getCell(1).font = bold;
    numFmt(rIgv.getCell(5));
    pintarFila(rIgv, COLOR_TOTALES);

    const rTot = addRow(['TOTAL:', '', '', '', comp.total ?? 0]);
    rTot.getCell(1).font = { bold: true, size: 11 };
    numFmt(rTot.getCell(5));
    pintarFila(rTot, COLOR_TOTALES);

    const blockEndRow = ws.lastRow.number;
    estilizarBloqueComprobante(ws, blockStartRow, blockEndRow);
  });

  addRow([]);
  addRow([]);

  const resumenStart = ws.lastRow.number + 1;
  const rResumen = addRow(['Resumen del periodo']);
  rResumen.getCell(1).font = titleFont;
  pintarFila(rResumen, COLOR_CABECERA);

  addRow(['Comprobantes:', totales.cantidadComprobantes ?? comprobantes.length]);
  const rSt = addRow(['Sub total:', totales.subTotal ?? 0]);
  numFmt(rSt.getCell(2));
  const rIg = addRow(['IGV:', totales.igv ?? 0]);
  numFmt(rIg.getCell(2));
  const rTt = addRow(['Total:', totales.total ?? 0]);
  rTt.getCell(1).font = bold;
  numFmt(rTt.getCell(2));

  estilizarBloqueComprobante(ws, resumenStart, ws.lastRow.number);

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 42;
  ws.getColumn(3).width = 12;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 14;

  return workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelDetalleUnaHoja };
