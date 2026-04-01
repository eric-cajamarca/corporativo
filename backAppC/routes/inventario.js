const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const inventarioController = require('../controllers/inventarioController');

router.use(auth.auth);

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
