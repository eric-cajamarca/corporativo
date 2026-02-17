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
router.post('/cajas', cajaController.crearCaja);

// Rutas para aperturas de caja
router.post('/abrir', cajaController.abrirCaja);
router.post('/cerrar', cajaController.cerrarCaja);

// Rutas para movimientos de caja
router.post('/movimiento', cajaController.registrarMovimiento);
router.get('/movimientos', cajaController.obtenerMovimientosCaja);
router.get('/recibos-egreso', cajaController.obtenerRecibosEgreso);
router.delete('/movimientos/:id', cajaController.eliminarMovimientoCaja);
router.put('/movimientos/:id', cajaController.actualizarMovimientoCaja);

// Rutas para tipos de movimiento (TiposMovimientoCaja - CRUD)
router.get('/tipos-movimiento', cajaController.obtenerTiposMovimientoCaja);
router.post('/tipos-movimiento', cajaController.crearTipoMovimientoCaja);
router.put('/tipos-movimiento/:id', cajaController.actualizarTipoMovimientoCaja);
router.delete('/tipos-movimiento/:id', cajaController.eliminarTipoMovimientoCaja);

// Rutas para reportes
router.get('/resumen-diario', cajaController.obtenerResumenCajaDiario);
router.get('/arqueo-dinamico', cajaController.obtenerArqueoDinamico);

module.exports = router;