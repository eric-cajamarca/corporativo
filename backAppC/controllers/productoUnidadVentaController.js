const productoUnidadVentaService = require('../services/productoUnidadVenta.service');
const { withPool } = require('../utils/dbPool.util');

async function obtener(req, res) {
  try {
    if (!req.user?.empresa) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const data = await withPool((pool) =>
      productoUnidadVentaService.obtenerPorProducto(pool, req.user.empresa, req.params.idProducto)
    );
    return res.status(200).send({ data });
  } catch (error) {
    console.error('productoUnidadVenta.obtener:', error);
    const msg = error.message || 'Error al obtener unidades de venta';
    const status = msg === 'Producto no encontrado' ? 404 : 400;
    return res.status(status).send({ message: msg, data: undefined });
  }
}

async function guardar(req, res) {
  try {
    if (!req.user?.empresa) {
      return res.status(401).send({ message: 'No Access', data: undefined });
    }
    const data = await withPool((pool) =>
      productoUnidadVentaService.guardar(pool, req.user.empresa, req.params.idProducto, req.body || {})
    );
    return res.status(200).send({ data, message: 'Unidades de venta guardadas' });
  } catch (error) {
    console.error('productoUnidadVenta.guardar:', error);
    const msg = error.message || 'Error al guardar unidades de venta';
    const status = msg === 'Producto no encontrado' ? 404 : 400;
    return res.status(status).send({ message: msg, data: undefined });
  }
}

module.exports = {
  obtener,
  guardar
};
