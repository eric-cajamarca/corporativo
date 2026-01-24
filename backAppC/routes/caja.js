const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para cajas
router.get('/cajas', cajaController.obtenerCajas);

// Rutas para aperturas de caja
router.post('/abrir', cajaController.abrirCaja);
router.post('/cerrar', cajaController.cerrarCaja);

// Rutas para movimientos de caja
router.post('/movimiento', cajaController.registrarMovimiento);
router.get('/movimientos', cajaController.obtenerMovimientosCaja);

// Rutas para tipos de movimiento
router.get('/tipos-movimiento', cajaController.obtenerTiposMovimientoCaja);

// Rutas para reportes
router.get('/resumen-diario', cajaController.obtenerResumenCajaDiario);

module.exports = router;