const ExcelJS = require('exceljs');

async function generateExcelFromData(data) {
  const workbook = new ExcelJS.Workbook();
  
  // Crear hoja con nombre personalizado
  const worksheetName = data.worksheetName || 'Reporte';
  const worksheet = workbook.addWorksheet(worksheetName);

  // Título del reporte
  if (data.title) {
    const mergeRange = `A1:${String.fromCharCode(64 + data.columns.length)}1`;
    worksheet.mergeCells(mergeRange);
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

  // Headers de columnas
  const headerRow = worksheet.addRow(data.columns);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { 
    type: 'pattern', 
    pattern: 'solid', 
    fgColor: { argb: 'FF2C3E50' } // Gris oscuro
  };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  // Datos
  data.rows.forEach((fila, index) => {
    const row = worksheet.addRow(fila);
    
    // Formatear números si es necesario
    fila.forEach((valor, colIndex) => {
      const cell = row.getCell(colIndex + 1);
      if (typeof valor === 'number' && valor > 1000) {
        cell.numFmt = '#,##0.00';
      }
    });

    // Alternar colores de filas
    if (index % 2 === 0) {
      row.fill = { 
        type: 'pattern', 
        pattern: 'solid', 
        fgColor: { argb: 'FFF5F5F5' } // Gris claro
      };
    }
  });

  // Auto-width para columnas
  worksheet.columns.forEach((column, index) => {
    let maxLength = data.columns[index]?.toString().length || 10;
    
    column.eachCell({ includeEmpty: false }, cell => {
      const cellLength = cell.value ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

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