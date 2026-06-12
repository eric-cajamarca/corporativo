const { generateExcelFromData } = require('../services/excel.service');
const { generateExcelComprasDetallado } = require('../services/comprasDetalleExcel.service');
const { generateExcelVentasDetallado } = require('../services/ventasDetalleExcel.service');

async function generateExcel(req, res) {
  const { data } = req.body;

  if (!data) {
    return res.status(400).json({ error: 'Datos incompletos para Excel' });
  }

  try {
    let excelBuffer = null;
    if (data.tipo === 'compras-detallado') {
      excelBuffer = await generateExcelComprasDetallado(data);
    } else if (data.tipo === 'ventas-detallado') {
      excelBuffer = await generateExcelVentasDetallado(data);
    } else if (data.rows && data.columns) {
      excelBuffer = await generateExcelFromData(data);
    }

    if (!excelBuffer) {
      return res.status(400).json({ error: 'Datos incompletos para Excel' });
    }
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte.xlsx"');
    res.send(excelBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el Excel' });
  }
}

module.exports = { generateExcel };