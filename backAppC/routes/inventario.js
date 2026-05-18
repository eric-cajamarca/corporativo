const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const inventarioController = require('../controllers/inventarioController');

router.use(auth.auth);

router.post('/conteo-fisico/sesiones', inventarioController.conteoFisicoCrearSesion);
router.get('/conteo-fisico/sesiones', inventarioController.conteoFisicoListarSesiones);
router.get('/conteo-fisico/sesiones/:idSesion/previsualizar', inventarioController.conteoFisicoPrevisualizar);
router.post('/conteo-fisico/sesiones/:idSesion/aplicar-movimientos', inventarioController.conteoFisicoAplicarMovimientos);
router.get('/conteo-fisico/sesiones/:idSesion/export', inventarioController.conteoFisicoExportData);
router.put('/conteo-fisico/sesiones/:idSesion/lineas/:idProducto', inventarioController.conteoFisicoUpsertLinea);
router.get('/conteo-fisico/sesiones/:idSesion', inventarioController.conteoFisicoObtenerSesion);

router.get('/stock-actual', inventarioController.stockActual);
router.get('/productos-vendidos', inventarioController.productosVendidos);
router.get('/productos-comprados', inventarioController.productosComprados);
router.post('/movimientos', inventarioController.registrarMovimiento);
router.get('/movimientos-resumen', inventarioController.listarMovimientosResumen);
router.get('/movimientos', inventarioController.listarMovimientos);
router.get('/movimientos/:id/lineas', inventarioController.listarLineasMovimientoCabecera);
router.get('/movimientos/:id', inventarioController.obtenerMovimientoPorId);
router.get('/tipos-movimiento', inventarioController.tiposMovimiento);
router.get('/kardex', inventarioController.kardex);

module.exports = router;
