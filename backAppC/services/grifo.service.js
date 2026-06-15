const { withPool } = require('../utils/dbPool.util');
const grifoRepository = require('../repositories/grifo.repository');
const { getFechaHoyApp, partesAhoraApp } = require('../utils/fechaDisplay.util');

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
    const { y, m } = partesAhoraApp();
    const yN = Number(y);
    const mN = Number(m);
    if (!fDesde) fDesde = `${y}-${m}-01T00:00:00`;
    if (!fHasta) {
      const ultimo = new Date(yN, mN, 0).getDate();
      fHasta = `${y}-${m}-${String(ultimo).padStart(2, '0')}T23:59:59`;
    }
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
