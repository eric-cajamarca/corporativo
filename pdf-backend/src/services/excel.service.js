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

async function generateExcelFromData(data) {
  const workbook = new ExcelJS.Workbook();
  
  // Crear hoja con nombre personalizado
  const worksheetName = data.worksheetName || 'Reporte';
  const worksheet = workbook.addWorksheet(worksheetName);

  const colCount = Math.max(1, (data.columns && data.columns.length) || 1);

  // Título del reporte (merge solo columnas A..N donde N = número de columnas de datos)
  if (data.title) {
    const lastCol = columnLetterFromIndex(colCount);
    worksheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = data.title;
    titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { 
      type: 'pattern', 
      pattern: 'solid', 
      fgColor: { argb: 'FF0056b3' } // Azul corporativo
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.height = 25;
  }

  // Headers: NO usar row.fill / row.font en el Row (ExcelJS sombrea toda la fila hasta el final de la hoja).
  const headerRow = worksheet.addRow(data.columns);
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

  // Datos: relleno alternado solo en celdas 1..colCount
  const zebraFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F5F5' }
  };
  data.rows.forEach((fila, index) => {
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

  // Auto-width solo para columnas de la tabla (1..colCount)
  for (let index = 0; index < colCount; index++) {
    const column = worksheet.getColumn(index + 1);
    let maxLength = data.columns[index]?.toString().length || 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value != null ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  }

  // Freeze pane (opcional) - congelar primera fila
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: data.title ? 2 : 1 }
  ];

  return await workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelFromData };


// const ExcelJS = require('exceljs');

// async function generateExcelFromData(data) {
//   // Ejemplo: data = { columns: [...], rows: [...], title: 'Reporte' }
//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet('Reporte');

//   // Título
//   if (data.title) {
//     worksheet.mergeCells('A1:D1');
//     const titleCell = worksheet.getCell('A1');
//     titleCell.value = data.title;
//     titleCell.font = { size: 16, bold: true };
//     titleCell.alignment = { horizontal: 'center' };
//   }

//   // Headers
//   worksheet.addRow([]); // Espacio
//   const headerRow = worksheet.addRow(data.columns);
//   headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
//   headerRow.fill = {
//     type: 'pattern',
//     pattern: 'solid',
//     fgColor: { argb: 'FF2C3E50' }
//   };

//   // Data
//   data.rows.forEach(row => worksheet.addRow(row));

//   // Auto-width
//   worksheet.columns.forEach(column => {
//     let maxLength = 0;
//     column.eachCell({ includeEmpty: false }, cell => {
//       const cellLength = cell.value ? cell.value.toString().length : 0;
//       maxLength = Math.max(maxLength, cellLength);
//     });
//     column.width = maxLength < 10 ? 10 : maxLength + 2;
//   });

//   return await workbook.xlsx.writeBuffer();
// }

// module.exports = { generateExcelFromData };