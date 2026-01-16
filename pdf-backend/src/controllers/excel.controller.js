const { generateExcelFromData } = require('../services/excel.service');

async function generateExcel(req, res) {
  const { data } = req.body;

  if (!data || !data.rows || !data.columns) {
    return res.status(400).json({ error: 'Datos incompletos para Excel' });
  }

  try {
    const excelBuffer = await generateExcelFromData(data);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte.xlsx"');
    res.send(excelBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el Excel' });
  }
}

module.exports = { generateExcel };