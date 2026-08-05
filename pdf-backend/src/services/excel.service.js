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

  if (data.title) {
    const lastCol = columnLetterFromIndex(colCount);
    worksheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = data.title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0056b3' }
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.height = 25;
  }

  const headerRow = worksheet.addRow(columns);
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' }
  };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' } };
  const headerAlign = { horizontal: 'center', vertical: 'middle' };
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
      if (typeof valor === 'number' && valor > 1000) {
        cell.numFmt = '#,##0.00';
      }
      if (index % 2 === 0) {
        cell.fill = zebraFill;
      }
    }
  });

  for (let index = 0; index < colCount; index++) {
    const column = worksheet.getColumn(index + 1);
    let maxLength = columns[index]?.toString().length || 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value != null ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
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
