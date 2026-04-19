const dventasService = require('../services/dventas.service');

async function obtenerDetalleVentas(req, res) {
  try {
    const rows = await dventasService.obtenerDetalleVentasConPool(req.user);
    res.json(rows);
  } catch (error) {
    if (error.message === 'NO_EMPRESA') {
      return res.status(403).json({ message: 'No autorizado: falta empresa en token' });
    }
    console.error('Error al obtener detalle de ventas:', error);
    res.status(500).json({ message: 'Error al obtener detalle de ventas' });
  }
}

async function obtenerDetalleVentaPorId_empresa(req, res) {
  if (!req.user) {
    return res.status(403).json({ message: 'No autorizado' });
  }
  const CompVentas = req.params.id;
  const Destino = req.params.idempresa;
  try {
    const rows = await dventasService.obtenerDetalleVentaPorCompDestinoConPool(req.user, CompVentas, Destino);
    res.json(rows);
  } catch (error) {
    if (error.message === 'NO_EMPRESA') {
      return res.status(403).json({ message: 'No autorizado: falta empresa en token' });
    }
    console.error('Error al obtener la venta:', error);
    res.status(500).send('Error al obtener la venta');
  }
}

async function actualizarDetalleVentakkk(req, res) {
  res.status(501).json({ message: 'No implementado' });
}

async function actualizarDetalleVenta(req, res) {
  if (!req.user) {
    return res.status(200).send({ message: 'No Access', data: undefined });
  }
  try {
    const { mensaje, estado } = await dventasService.actualizarDetalleVentaLoteConPool(req.user, req.body);
    res.status(200).send({ message: mensaje, data: estado });
  } catch (error) {
    console.error('Error al actualizar el detalle de venta:', error);
    res.status(200).send({ message: 'Error al actualizar el detalle de venta', data: undefined });
  }
}

async function eliminarDetalleVenta(req, res) {
  const idDetalle = parseInt(req.params.id, 10);
  if (Number.isNaN(idDetalle) || idDetalle < 1) {
    return res.status(400).json({ message: 'id de detalle inválido' });
  }
  try {
    const out = await dventasService.eliminarDetalleVentaConPool(req.user, idDetalle);
    if (out.notFound) {
      return res.status(404).json({ message: 'El registro no existe o no pertenece a tu empresa' });
    }
    if (out.anulada) {
      return res.status(400).json({ message: 'No se puede eliminar línea: la venta está anulada.' });
    }
    if (out.sunatBloqueo) {
      return res.status(400).json({
        message: 'No se puede eliminar la línea: el comprobante ya fue enviado o aceptado en SUNAT.'
      });
    }
    res.json({ message: 'Registro eliminado correctamente; el stock de la línea fue devuelto.' });
  } catch (error) {
    console.error('Error al eliminar el detalle de venta:', error);
    res.status(500).json({ message: error.message || 'Error al eliminar el detalle de venta' });
  }
}

module.exports = {
  obtenerDetalleVentas,
  obtenerDetalleVentaPorId_empresa,
  actualizarDetalleVenta,
  eliminarDetalleVenta,
  actualizarDetalleVentakkk
};
