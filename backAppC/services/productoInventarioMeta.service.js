const ProductosRepository = require('../repositories/productos.repository');
const { esCodigoPresentacionServicio } = require('../utils/productoInventariable.util');

function cacheKey(idEmpresa, idProducto) {
  return `${String(idEmpresa).toLowerCase()}|${String(idProducto).toLowerCase()}`;
}

/**
 * Meta de inventario por producto (presentación + costo referencia).
 * @param {Map|null} cache Map opcional idEmpresa|idProducto → meta
 */
async function obtenerMeta(executor, idEmpresa, idProducto, cache = null) {
  const key = cacheKey(idEmpresa, idProducto);
  if (cache && cache.has(key)) {
    return cache.get(key);
  }
  const row = await ProductosRepository.obtenerMetaInventarioProducto(executor, idEmpresa, idProducto);
  const codigoPresentacion = row?.codigoPresentacion || '';
  const meta = {
    codigoPresentacion,
    cUnitario: Number(row?.cUnitario) || 0,
    controlaInventario: !esCodigoPresentacionServicio(codigoPresentacion)
  };
  if (cache) cache.set(key, meta);
  return meta;
}

async function controlaInventarioPorIdPresentacion(executor, idPresentacion) {
  const codigo = await ProductosRepository.obtenerCodigoPresentacionPorId(executor, idPresentacion);
  return !esCodigoPresentacionServicio(codigo);
}

module.exports = {
  obtenerMeta,
  controlaInventarioPorIdPresentacion
};
