// services/stock.service.js
const stockRepository = require('../repositories/stock.repository');

exports.descontarStock = async (transaction, stockData) => {
  return await stockRepository.ejecutarDescuento(transaction, stockData);
};

/** Descuenta stock desde tabla Lotes (cantidadDisponible). Usado en crearVentaCompleta. */
exports.descontarDesdeLotes = async (transaction, stockData) => {
  return await stockRepository.descontarDesdeLotes(transaction, stockData);
};