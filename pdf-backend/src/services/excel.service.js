const ExcelJS = require('exceljs');

async function generateExcelFromData(data) {
  // Ejemplo: data = { columns: [...], rows: [...], title: 'Reporte' }
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Reporte');

  // Título
  if (data.title) {
    worksheet.mergeCells('A1:D1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = data.title;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };
  }

  // Headers
  worksheet.addRow([]); // Espacio
  const headerRow = worksheet.addRow(data.columns);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2C3E50' }
  };

  // Data
  data.rows.forEach(row => worksheet.addRow(row));

  // Auto-width
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: false }, cell => {
      const cellLength = cell.value ? cell.value.toString().length : 0;
      maxLength = Math.max(maxLength, cellLength);
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  return await workbook.xlsx.writeBuffer();
}

module.exports = { generateExcelFromData };