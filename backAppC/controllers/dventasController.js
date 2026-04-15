const sql = require('mssql');
const dbConfig = require('../dbconfig');
const dventasService = require('../services/dventas.service');

async function obtenerDetalleVentas(req, res) {
  const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
  if (!idEmpresa) {
    return res.status(403).json({ message: 'No autorizado: falta empresa en token' });
  }
  try {
    const pool = await sql.connect(dbConfig);
    const rows = await dventasService.obtenerDetalleVentas(pool, idEmpresa);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener detalle de ventas:', error);
    res.status(500).json({ message: 'Error al obtener detalle de ventas' });
  }
}

async function obtenerDetalleVentaPorId_empresa(req, res) {
  const CompVentas = req.params.id;
  const Destino = req.params.idempresa;
  try {
    const pool = await sql.connect(dbConfig);
    const rows = await dventasService.obtenerDetalleVentaPorCompDestino(pool, CompVentas, Destino);
    res.json(rows);
  } catch (error) {
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
    const pool = await sql.connect(dbConfig);
    const { mensaje, estado } = await dventasService.actualizarDetalleVentaLote(pool, req.user, req.body);
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
    const pool = await sql.connect(dbConfig);
    const out = await dventasService.eliminarDetalleVenta(pool, req.user, idDetalle);
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
