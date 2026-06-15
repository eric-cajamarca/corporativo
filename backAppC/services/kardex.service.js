// services/kardex.service.js
const { withPool } = require('../utils/dbPool.util');
const kardexRepository = require('../repositories/kardex.repository');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');

/**
 * Obtiene el kardex de un producto en un rango de fechas.
 * @param {string} idEmpresa - UUID de la empresa (del token)
 * @param {string} idProducto - UUID del producto
 * @param {string} fechaDesde - ISO o YYYY-MM-DD
 * @param {string} fechaHasta - ISO o YYYY-MM-DD
 */
exports.obtenerKardex = async (idEmpresa, idProducto, fechaDesde, fechaHasta) => {
  if (!idEmpresa || !idProducto) {
    throw new Error('idEmpresa e idProducto son obligatorios');
  }
  const { y, m } = partesAhoraApp();
  const desde = fechaDesde || `${y}-${m}-01`;
  const hasta = fechaHasta || getFechaHoyApp();
  return withPool((pool) =>
    kardexRepository.obtenerKardex(pool, idEmpresa, idProducto, desde, hasta)
  );
};
