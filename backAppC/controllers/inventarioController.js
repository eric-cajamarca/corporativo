// controllers/inventarioController.js
const inventarioService = require('../services/inventario.service');
const kardexService = require('../services/kardex.service');

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
 * GET /api/inventario/movimientos-resumen
 * Cabeceras agrupadas (pantalla Movimientos).
 */
exports.listarMovimientosResumen = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const lista = await inventarioService.listarMovimientosResumen(req.user.empresa, req.query);
    return res.status(200).json(lista);
  } catch (error) {
    console.error('inventarioController listarMovimientosResumen:', error);
    return res.status(500).json({ message: error.message || 'Error al listar movimientos' });
  }
};

/**
 * GET /api/inventario/movimientos/:id/lineas
 * Detalle de líneas de una cabecera.
 */
exports.listarLineasMovimientoCabecera = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'Id de movimiento inválido' });
    }
    const lineas = await inventarioService.listarLineasMovimientoCabecera(req.user.empresa, id);
    return res.status(200).json(lineas);
  } catch (error) {
    console.error('inventarioController listarLineasMovimientoCabecera:', error);
    return res.status(500).json({ message: 'Error al obtener líneas del movimiento' });
  }
};

/**
 * GET /api/inventario/movimientos/:id
 * Obtiene un movimiento por id (detalle para modal).
 */
exports.obtenerMovimientoPorId = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Id de movimiento inválido' });
    }
    const movimiento = await inventarioService.obtenerMovimientoPorId(req.user.empresa, id);
    if (!movimiento) {
      return res.status(404).json({ message: 'Movimiento no encontrado' });
    }
    return res.status(200).json(movimiento);
  } catch (error) {
    console.error('inventarioController obtenerMovimientoPorId:', error);
    return res.status(500).json({ message: 'Error al obtener movimiento' });
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

/**
 * GET /api/inventario/kardex?idProducto=...&fechaDesde=...&fechaHasta=...
 * Reporte kardex: compras, ventas y movimientos de un producto ordenados por fecha.
 */
exports.kardex = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idProducto = req.query.idProducto || null;
    const fechaDesde = req.query.fechaDesde || null;
    const fechaHasta = req.query.fechaHasta || null;
    if (!idProducto) {
      return res.status(400).json({ message: 'idProducto es obligatorio' });
    }
    const resultado = await kardexService.obtenerKardex(req.user.empresa, idProducto, fechaDesde, fechaHasta);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('inventarioController kardex:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener kardex' });
  }
};

/**
 * GET /api/inventario/stock-actual
 * Lista stock agregado por producto con filtros opcionales.
 */
exports.stockActual = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const resultado = await inventarioService.obtenerStockActual(req.user, req.query);
    return res.status(200).json(resultado);
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (error.message === 'NO_PERMISO_STOCK_ACTUAL') {
      return res.status(403).json({ message: 'No tiene permiso para ver stock actual' });
    }
    console.error('inventarioController stockActual:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener stock actual' });
  }
};

/**
 * GET /api/inventario/productos-vendidos
 */
exports.productosVendidos = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const resultado = await inventarioService.obtenerProductosVendidos(req.user, req.query);
    return res.status(200).json(resultado);
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (error.message === 'NO_PERMISO_PRODUCTOS_VENDIDOS') {
      return res.status(403).json({ message: 'No tiene permiso para ver productos vendidos' });
    }
    console.error('inventarioController productosVendidos:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener productos vendidos' });
  }
};

/**
 * GET /api/inventario/productos-comprados
 */
exports.productosComprados = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const resultado = await inventarioService.obtenerProductosComprados(req.user, req.query);
    return res.status(200).json(resultado);
  } catch (error) {
    if (error.message === 'NO_AUTH') {
      return res.status(401).json({ message: 'No autorizado' });
    }
    if (error.message === 'NO_PERMISO_PRODUCTOS_COMPRADOS') {
      return res.status(403).json({ message: 'No tiene permiso para ver productos comprados' });
    }
    console.error('inventarioController productosComprados:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener productos comprados' });
  }
};
