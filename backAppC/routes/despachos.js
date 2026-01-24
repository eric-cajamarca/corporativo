const express = require('express');
const router = express.Router();
const despachosController = require('../controllers/despachosController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para gestión de despachos
router.get('/venta/:idVenta', despachosController.obtenerDespachosVenta);
router.post('/', despachosController.crearDespacho);
router.put('/detalle/:idDetalleDespacho/cantidad', despachosController.actualizarCantidadDespachada);
router.put('/:idDespacho/finalizar', despachosController.finalizarDespacho);

// Rutas para catálogos
router.get('/tipos', despachosController.obtenerTiposDespacho);

// Rutas para reportes
router.get('/estado', despachosController.obtenerEstadoDespachos);

module.exports = router;