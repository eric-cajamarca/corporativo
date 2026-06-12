const { generateExcelDetalleUnaHoja } = require('./detalleReporteExcel.service');

async function generateExcelVentasDetallado(data) {
  return generateExcelDetalleUnaHoja(data, {
    titulo: 'REPORTE DE VENTAS DETALLADO',
    tituloDetalle: 'DETALLE DE VENTA',
    etiquetaTercero: 'CLIENTE',
    campoTercero: 'cliente',
    sinDatosMsg: 'No hay ventas en el periodo seleccionado.',
  });
}

module.exports = { generateExcelVentasDetallado };
