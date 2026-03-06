const dbConfig = require('../dbconfig');
const sql = require('mssql');
const reportesService = require('../services/reportes.service');

// GET /api/reportes/compras-proveedor?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
const getComprasPorProveedor = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const { fechaInicio, fechaFin } = req.query;
    const pool = await sql.connect(dbConfig);
    const data = await reportesService.obtenerComprasPorProveedor(
      pool,
      idEmpresa,
      fechaInicio,
      fechaFin
    );
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    if (
      error.message &&
      (error.message.includes('requeridos') ||
        error.message.includes('inválidas') ||
        error.message.includes('mayor'))
    ) {
      return res.status(400).json({ message: error.message, data: null });
    }
    console.error('Error getComprasPorProveedor:', error);
    return res.status(500).json({
      message: 'Error al obtener compras por proveedor',
      data: null,
    });
  }
};

// GET /api/reportes/inventario-resumen
const getInventarioResumen = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const pool = await sql.connect(dbConfig);
    const data = await reportesService.obtenerInventarioResumen(pool, idEmpresa);
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    console.error('Error getInventarioResumen:', error);
    return res.status(500).json({
      message: 'Error al obtener resumen de inventario',
      data: null,
    });
  }
};

// GET /api/reportes/clientes-rentabilidad?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
const getClientesRentabilidad = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const { fechaInicio, fechaFin } = req.query;
    const pool = await sql.connect(dbConfig);
    const data = await reportesService.obtenerClientesRentabilidad(
      pool,
      idEmpresa,
      fechaInicio,
      fechaFin
    );
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    if (
      error.message &&
      (error.message.includes('requeridos') ||
        error.message.includes('inválidas') ||
        error.message.includes('mayor'))
    ) {
      return res.status(400).json({ message: error.message, data: null });
    }
    console.error('Error getClientesRentabilidad:', error);
    return res.status(500).json({
      message: 'Error al obtener análisis de clientes',
      data: null,
    });
  }
};

// GET /api/reportes/cartera-creditos
const getCarteraCreditos = async (req, res) => {
  try {
    const idEmpresa = req.user?.empresa || req.user?.idEmpresa;
    if (!idEmpresa) {
      return res.status(403).json({
        message: 'No autorizado: falta empresa',
        data: null,
      });
    }
    const pool = await sql.connect(dbConfig);
    const data = await reportesService.obtenerCarteraCreditos(pool, idEmpresa);
    return res.status(200).json({ message: 'OK', data });
  } catch (error) {
    console.error('Error getCarteraCreditos:', error);
    return res.status(500).json({
      message: 'Error al obtener cartera de créditos',
      data: null,
    });
  }
};

module.exports = {
  getComprasPorProveedor,
  getInventarioResumen,
  getClientesRentabilidad,
  getCarteraCreditos,
};

