// controllers/inventarioController.js
const inventarioService = require('../services/inventario.service');

/**
 * POST /api/inventario/movimientos
 * Registra un movimiento (inventario inicial, entrada varia, reajuste, salida/merma).
 */
exports.registrarMovimiento = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idUsuario = req.user.sub || req.user.idUsuario;
    const resultado = await inventarioService.procesarMovimiento(req.user.empresa, idUsuario, req.body);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('inventarioController registrarMovimiento:', error);
    const msg = error.message || 'Error al registrar movimiento';
    return res.status(500).json({ message: msg });
  }
};

/**
 * GET /api/inventario/movimientos
 * Lista movimientos con filtros: fechaInicio, fechaFin, idSucursal, tipoMovimiento.
 */
exports.listarMovimientos = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const filtros = {
      fechaInicio: req.query.fechaInicio || null,
      fechaFin: req.query.fechaFin || null,
      idSucursal: req.query.idSucursal || null,
      tipoMovimiento: req.query.tipoMovimiento || null
    };
    const lista = await inventarioService.listarMovimientos(req.user.empresa, filtros);
    return res.status(200).json(lista);
  } catch (error) {
    console.error('inventarioController listarMovimientos:', error);
    return res.status(500).json({ message: 'Error al listar movimientos' });
  }
};

/**
 * GET /api/inventario/tipos-movimiento
 * Devuelve opciones para el dropdown Tipo de movimiento.
 */
exports.tiposMovimiento = (req, res) => {
  try {
    const tipos = inventarioService.obtenerTiposMovimiento();
    return res.status(200).json(tipos);
  } catch (error) {
    console.error('inventarioController tiposMovimiento:', error);
    return res.status(500).json({ message: 'Error al obtener tipos' });
  }
};
