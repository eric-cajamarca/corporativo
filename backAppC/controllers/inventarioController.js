// controllers/inventarioController.js
const inventarioService = require('../services/inventario.service');
const kardexService = require('../services/kardex.service');
const conteoFisicoService = require('../services/conteoFisico.service');
const auditoriaOperaciones = require('../services/auditoriaOperaciones.service');

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
    const tipo = req.body?.tipoMovimiento || 'MOVIMIENTO';
    auditoriaOperaciones.auditarInventario(
      req,
      tipo,
      resultado?.idMovimiento,
      req.body?.docRelacionado || null,
      req.body?.observaciones || null
    );
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
    const lista = await inventarioService.listarMovimientosResumen(req.user, req.query);
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
 * GET /api/inventario/kardex-completo?fechaDesde=...&fechaHasta=...
 * Formato 13.1: inventario permanente valorizado de todos los productos.
 */
exports.kardexCompleto = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const fechaDesde = req.query.fechaDesde || null;
    const fechaHasta = req.query.fechaHasta || null;
    const resultado = await kardexService.obtenerKardexCompleto(req.user.empresa, fechaDesde, fechaHasta);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('inventarioController kardexCompleto:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener kardex completo' });
  }
};

/**
 * GET /api/inventario/costo-sugerido?idProducto=&idSucursal=
 */
exports.costoSugerido = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idProducto = req.query.idProducto || null;
    const idSucursal = req.query.idSucursal || null;
    const data = await inventarioService.obtenerCostoSugerido(req.user.empresa, idProducto, idSucursal);
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController costoSugerido:', error);
    const msg = error.message || 'Error al obtener costo sugerido';
    if (msg.includes('obligatorio')) {
      return res.status(400).json({ message: msg });
    }
    return res.status(500).json({ message: msg });
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

/** GET /api/inventario/conteo-fisico/sesiones?soloConLineas=true */
exports.conteoFisicoListarSesiones = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const q = req.query?.soloConLineas;
    const soloConLineas = q === undefined || q === 'true' || q === '1';
    const sesiones = await conteoFisicoService.listarSesionesPendientes(req.user.empresa, {
      soloConLineas
    });
    return res.status(200).json({ sesiones });
  } catch (error) {
    console.error('inventarioController conteoFisicoListarSesiones:', error);
    return res.status(500).json({ message: error.message || 'Error al listar sesiones de conteo' });
  }
};

/** POST /api/inventario/conteo-fisico/sesiones */
exports.conteoFisicoCrearSesion = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idUsuario = req.user.sub || req.user.idUsuario;
    const resultado = await conteoFisicoService.crearSesion(req.user.empresa, idUsuario, req.body);
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('inventarioController conteoFisicoCrearSesion:', error);
    return res.status(500).json({ message: error.message || 'Error al crear sesión de conteo' });
  }
};

/** GET /api/inventario/conteo-fisico/sesiones/:idSesion */
exports.conteoFisicoObtenerSesion = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const data = await conteoFisicoService.obtenerSesion(req.user.empresa, req.params.idSesion);
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController conteoFisicoObtenerSesion:', error);
    const msg = error.message || 'Error al obtener sesión';
    if (msg === 'Sesión no encontrada') {
      return res.status(404).json({ message: msg });
    }
    return res.status(500).json({ message: msg });
  }
};

/** GET /api/inventario/conteo-fisico/sesiones/:idSesion/previsualizar */
exports.conteoFisicoPrevisualizar = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const data = await conteoFisicoService.previsualizarAplicacion(req.user.empresa, req.params.idSesion);
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController conteoFisicoPrevisualizar:', error);
    return res.status(500).json({ message: error.message || 'Error al previsualizar' });
  }
};

/** PUT /api/inventario/conteo-fisico/sesiones/:idSesion/lineas/:idProducto */
exports.conteoFisicoUpsertLinea = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const body = { ...(req.body || {}), idProducto: req.params.idProducto };
    const data = await conteoFisicoService.upsertLinea(req.user, req.params.idSesion, body);
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController conteoFisicoUpsertLinea:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar línea' });
  }
};

/** POST /api/inventario/conteo-fisico/sesiones/:idSesion/aplicar-movimientos */
exports.conteoFisicoAplicarMovimientos = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const idUsuario = req.user.sub || req.user.idUsuario;
    const data = await conteoFisicoService.aplicarMovimientos(
      req.user.empresa,
      idUsuario,
      req.params.idSesion,
      req.body || {}
    );
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController conteoFisicoAplicarMovimientos:', error);
    return res.status(500).json({ message: error.message || 'Error al aplicar movimientos' });
  }
};

/** GET /api/inventario/conteo-fisico/sesiones/:idSesion/export (JSON para Excel/PDF en cliente; sesión cerrada) */
exports.conteoFisicoExportData = async (req, res) => {
  try {
    if (!req.user || !req.user.empresa) {
      return res.status(401).json({ message: 'No autorizado' });
    }
    const data = await conteoFisicoService.obtenerSesionParaExport(req.user.empresa, req.params.idSesion);
    return res.status(200).json(data);
  } catch (error) {
    console.error('inventarioController conteoFisicoExportData:', error);
    const msg = error.message || 'Error al exportar';
    if (msg.includes('solo está disponible')) {
      return res.status(400).json({ message: msg });
    }
    return res.status(500).json({ message: msg });
  }
};
