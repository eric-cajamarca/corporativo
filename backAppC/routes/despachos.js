const express = require('express');
const router = express.Router();
const despachosController = require('../controllers/despachosController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Búsqueda por comprobante o idVenta
router.get('/buscar', despachosController.buscarVentaDespachos);

// Rutas para gestión de despachos
router.get('/venta/:idVenta', despachosController.obtenerDespachosVenta);
router.get('/tipos', despachosController.obtenerTiposDespacho);
router.get('/estado', despachosController.obtenerEstadoDespachos);
router.get('/:idDespacho/detalle', despachosController.obtenerDetalleDespacho);

router.post('/', despachosController.crearDespacho);
router.put('/detalle/:idDetalleDespacho/cantidad', despachosController.actualizarCantidadDespachada);
router.put('/:idDespacho/finalizar', despachosController.finalizarDespacho);

module.exports = router;