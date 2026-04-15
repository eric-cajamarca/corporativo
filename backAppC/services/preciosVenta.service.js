const preciosVentaRepository = require('../repositories/preciosVenta.repository');

async function crearDesdeDetalle(pool, detalle) {
  await preciosVentaRepository.insertar(pool, {
    idProducto: detalle.idProducto,
    cUnitario: detalle.pUnitario,
    mayorista: 0,
    cliente: 0,
    transeunte: 0
  });
}

async function obtenerPorId(pool, idPreciosV) {
  return preciosVentaRepository.obtenerPorId(pool, idPreciosV);
}

async function listarTodos(pool) {
  return preciosVentaRepository.listarTodos(pool);
}

async function actualizar(pool, body) {
  const { idPreciosV, idProducto, cUnitario, mayorista, cliente, transeunte } = body;
  return preciosVentaRepository.actualizar(pool, {
    idPreciosV,
    idProducto,
    cUnitario,
    mayorista,
    cliente,
    transeunte
  });
}

module.exports = {
  crearDesdeDetalle,
  obtenerPorId,
  listarTodos,
  actualizar
};
