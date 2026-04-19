const { withPool } = require('../utils/dbPool.util');
const grifoRepository = require('../repositories/grifo.repository');

async function listarTanques(idEmpresa) {
  return withPool((pool) => grifoRepository.listarTanques(pool, idEmpresa));
}

async function actualizarTanque(idTanque, idEmpresa, datos) {
  return withPool((pool) => grifoRepository.actualizarTanque(pool, idTanque, idEmpresa, datos));
}

async function crearTanque(idEmpresa, body) {
  return withPool(async (pool) => {
    const { idProducto, idSucursal, capacidad, cantidadActual } = body || {};
    if (!idProducto) throw new Error('idProducto es requerido');
    return grifoRepository.crearTanqueSiNoExiste(pool, idEmpresa, idProducto, idSucursal || null, capacidad || 0, cantidadActual || 0);
  });
}

async function resumenGrifo(idEmpresa, fechaDesde, fechaHasta) {
  let fDesde = fechaDesde;
  let fHasta = fechaHasta;
  if (!fDesde || !fHasta) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    if (!fDesde) fDesde = `${y}-${m}-01T00:00:00`;
    if (!fHasta) fHasta = new Date(y, now.getMonth() + 1, 0).toISOString().slice(0, 10) + 'T23:59:59';
  }
  return withPool((pool) => grifoRepository.resumenGrifo(pool, idEmpresa, fDesde, fHasta));
}

async function listarProductosCombustibles(idEmpresa) {
  return withPool((pool) => grifoRepository.listarProductosCombustibles(pool, idEmpresa));
}

module.exports = {
  listarTanques,
  actualizarTanque,
  crearTanque,
  resumenGrifo,
  listarProductosCombustibles
};
