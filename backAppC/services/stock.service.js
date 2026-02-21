// services/stock.service.js
const stockRepository = require('../repositories/stock.repository');

exports.descontarStock = async (transaction, stockData) => {
  return await stockRepository.ejecutarDescuento(transaction, stockData);
};

/** Obtiene stock disponible (suma Lotes.cantidadDisponible) por producto/empresa/sucursal. */
exports.obtenerStockDisponible = async (transaction, idEmpresa, idProducto, idSucursal) => {
  return await stockRepository.obtenerStockDisponible(transaction, idEmpresa, idProducto, idSucursal);
};

/** Descuenta stock desde Lotes (y opcionalmente LotesUbicacion por prioridad). opciones.controlUbicaciones = false para solo Lotes. */
exports.descontarDesdeLotes = async (transaction, stockData, opciones = {}) => {
  return await stockRepository.descontarDesdeLotes(transaction, stockData, opciones);
};