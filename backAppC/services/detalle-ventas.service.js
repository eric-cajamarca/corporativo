// services/detalle-venta.service.js
const detalleVentaRepository = require('../repositories/detalle-ventas.repository');

exports.crearDetalle = async (transaction, detalleData) => {
  // ✅ El Service solo delega al Repository
  return await detalleVentaRepository.insertar(transaction, detalleData);
};

