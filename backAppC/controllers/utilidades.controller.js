const { withPool } = require('../utils/dbPool.util');
const utilidadesService = require('../services/utilidades.service');

/**
 * GET /api/utilidades?tipo=dia|mes|anio|rango&fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 * Solo administrador. idEmpresa del token.
 */
const getUtilidades = async (req, res) => {
  try {
    if (req.user?.rol !== 'Administrador') {
      return res.status(403).json({
        message: 'Solo el administrador puede ver el reporte de utilidades',
        data: null,
      });
    }
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const { tipo, fechaInicio, fechaFin } = req.query;
    const data = await withPool(async (pool) =>
      utilidadesService.obtenerUtilidades(
        pool,
        idEmpresa,
        tipo,
        fechaInicio,
        fechaFin
      )
    );
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    if (error.message && error.message.includes('no válido') || error.message.includes('requeridos') || error.message.includes('inválidas') || error.message.includes('mayor')) {
      return res.status(400).json({ message: error.message, data: null });
    }
    console.error('Error getUtilidades:', error);
    return res.status(500).json({
      message: 'Error al obtener utilidades',
      data: null,
    });
  }
};

/**
 * GET /api/utilidades/detalle?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 * Devuelve una fila por línea de venta: producto, fecha, comprobante, precio, costo, utilidadBruta, idVenta.
 */
const getUtilidadesDetalle = async (req, res) => {
  try {
    if (req.user?.rol !== 'Administrador') {
      return res.status(403).json({
        message: 'Solo el administrador puede ver el reporte de utilidades',
        data: null,
      });
    }
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const { fechaInicio, fechaFin } = req.query;
    const data = await withPool(async (pool) =>
      utilidadesService.obtenerUtilidadesDetalle(
        pool,
        idEmpresa,
        fechaInicio,
        fechaFin
      )
    );
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    if (error.message && (error.message.includes('no válido') || error.message.includes('requeridos') || error.message.includes('inválidas') || error.message.includes('mayor'))) {
      return res.status(400).json({ message: error.message, data: null });
    }
    console.error('Error getUtilidadesDetalle:', error);
    return res.status(500).json({
      message: 'Error al obtener detalle de utilidades',
      data: null,
    });
  }
};

module.exports = {
  getUtilidades,
  getUtilidadesDetalle,
};
