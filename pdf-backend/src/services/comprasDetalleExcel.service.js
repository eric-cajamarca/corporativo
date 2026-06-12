const { generateExcelDetalleUnaHoja } = require('./detalleReporteExcel.service');

async function generateExcelComprasDetallado(data) {
  return generateExcelDetalleUnaHoja(data, {
    titulo: 'REPORTE DE COMPRAS DETALLADO',
    tituloDetalle: 'DETALLE DE COMPRA',
    etiquetaTercero: 'PROVEEDOR',
    campoTercero: 'proveedor',
    sinDatosMsg: 'No hay compras en el periodo seleccionado.',
  });
}

module.exports = { generateExcelComprasDetallado };
