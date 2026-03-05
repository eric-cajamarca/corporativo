const dbConfig = require('../dbconfig');
const sql = require('mssql');
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
    const pool = await sql.connect(dbConfig);
    const data = await utilidadesService.obtenerUtilidades(
      pool,
      idEmpresa,
      tipo,
      fechaInicio,
      fechaFin
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
  // #region agent log
  try {
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.controller.js:getUtilidadesDetalle:entry', message: 'getUtilidadesDetalle entered', data: { hasUser: !!req.user, rol: req.user?.rol, idEmpresa: req.user?.empresa || req.user?.idEmpresa || null, fechaInicio: req.query?.fechaInicio, fechaFin: req.query?.fechaFin }, timestamp: Date.now(), hypothesisId: 'H3_H5' }) }).catch(() => {});
  } catch (_) {}
  // #endregion
  try {
    if (req.user?.rol !== 'Administrador') {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.controller.js:getUtilidadesDetalle:403', message: 'getUtilidadesDetalle 403 rol', data: { rol: req.user?.rol }, timestamp: Date.now(), hypothesisId: 'H5' }) }).catch(() => {});
      // #endregion
      return res.status(403).json({
        message: 'Solo el administrador puede ver el reporte de utilidades',
        data: null,
      });
    }
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.controller.js:getUtilidadesDetalle:403', message: 'getUtilidadesDetalle 403 no empresa', data: {}, timestamp: Date.now(), hypothesisId: 'H5' }) }).catch(() => {});
      // #endregion
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const { fechaInicio, fechaFin } = req.query;
    const pool = await sql.connect(dbConfig);
    const data = await utilidadesService.obtenerUtilidadesDetalle(
      pool,
      idEmpresa,
      fechaInicio,
      fechaFin
    );
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.controller.js:getUtilidadesDetalle:success', message: 'getUtilidadesDetalle success', data: { dataLength: Array.isArray(data) ? data.length : typeof data }, timestamp: Date.now(), hypothesisId: 'H2' }) }).catch(() => {});
    // #endregion
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '486b2c' }, body: JSON.stringify({ sessionId: '486b2c', location: 'utilidades.controller.js:getUtilidadesDetalle:catch', message: 'getUtilidadesDetalle error', data: { errorMessage: error?.message }, timestamp: Date.now(), hypothesisId: 'H4' }) }).catch(() => {});
    // #endregion
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
