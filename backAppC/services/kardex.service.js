// services/kardex.service.js
const { withPool } = require('../utils/dbPool.util');
const kardexRepository = require('../repositories/kardex.repository');

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
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const desde = fechaDesde || inicioMes.toISOString().slice(0, 10);
  const hasta = fechaHasta || hoy.toISOString().slice(0, 10);
  return withPool((pool) =>
    kardexRepository.obtenerKardex(pool, idEmpresa, idProducto, desde, hasta)
  );
};
