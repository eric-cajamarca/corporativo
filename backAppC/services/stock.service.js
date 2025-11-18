// services/stock.service.js
const stockRepository = require('../repositories/stock.repository');

exports.descontarStock = async (transaction, stockData) => {
  // ✅ El Service solo delega al Repository
  return await stockRepository.ejecutarDescuento(transaction, stockData);
};