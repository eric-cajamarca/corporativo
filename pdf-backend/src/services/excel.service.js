const ExcelJS = require('exceljs');

/** Letra de columna Excel (1=A, 8=H, 27=AA). Para merge solo sobre el ancho de la tabla. */
function columnLetterFromIndex(colIndex) {
  let n = colIndex;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function addWorksheetFromData(workbook, data) {
  const worksheetName = data.worksheetName || 'Reporte';
  const worksheet = workbook.addWorksheet(worksheetName);

  const columns = Array.isArray(data.columns) ? data.columns : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const colCount = Math.max(1, columns.length || 1);
  const MIN_WIDTH = 5;
  const MAX_WIDTH = 32;
  const titleRowNumber = data.title ? 1 : 0;

  if (data.title) {
    const lastCol = columnLetterFromIndex(colCount);
    worksheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = data.title;
    titleCell.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0056b3' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    worksheet.getRow(1).height = 22;
  }

  const headerRow = worksheet.addRow(columns);
  headerRow.height = 28;
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' }
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  const headerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true };
  for (let c = 1; c <= colCount; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = headerAlign;
  }

  const zebraFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' }
  };
  rows.forEach((fila, index) => {
    const row = worksheet.addRow(fila);

    for (let colIndex = 0; colIndex < colCount; colIndex++) {
      const cell = row.getCell(colIndex + 1);
      const valor = fila[colIndex];
      if (typeof valor === 'number') {
        if (valor > 1000) cell.numFmt = '#,##0.00';
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { vertical: 'middle', wrapText: true };
      }
      if (index % 2 === 0) {
        cell.fill = zebraFill;
      }
    }
  });

  const anchosExplicitos = Array.isArray(data.columnWidths) ? data.columnWidths : [];
  for (let index = 0; index < colCount; index++) {
    const column = worksheet.getColumn(index + 1);
    const anchoDado = Number(anchosExplicitos[index]);
    if (Number.isFinite(anchoDado) && anchoDado > 0) {
      column.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, anchoDado));
      continue;
    }
    let maxLength = Math.min(columns[index]?.toString().length || MIN_WIDTH, 18);
    column.eachCell({ includeEmpty: false }, (cell) => {
      if (titleRowNumber && cell.row === titleRowNumber) return;
      if (cell.row === headerRow.number) return;
      const cellLength = cell.value != null ? String(cell.value).length : 0;
      maxLength = Math.max(maxLength, Math.min(cellLength, MAX_WIDTH));
    });
    column.width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, maxLength + 2));
  }

  worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: data.title ? 2 : 1 }];
}

async function generateExcelFromData(data) {
  const workbook = new ExcelJS.Workbook();

  if (Array.isArray(data.sheets) && data.sheets.length > 0) {
    for (const sheet of data.sheets) {
      if (!sheet || !Array.isArray(sheet.columns)) {
        throw new Error('EXCEL_SHEET_INVALIDA');
      }
      addWorksheetFromData(workbook, sheet);
    }
    return workbook.xlsx.writeBuffer();
  }

  addWorksheetFromData(workbook, data);
  return workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelFromData };
