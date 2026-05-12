const express = require('express');
const router = express.Router();
const despachosController = require('../controllers/despachosController');
const devolucionesDespachoController = require('../controllers/devolucionesDespachoController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Búsqueda por comprobante o idVenta
router.get('/buscar', despachosController.buscarVentaDespachos);
router.get('/venta-agrupada/buscar', despachosController.buscarVentaAgrupadaDespachoGestora);

// Rutas para gestión de despachos
router.get('/venta/:idVenta', despachosController.obtenerDespachosVenta);
router.get('/tipos', despachosController.obtenerTiposDespacho);
router.get('/estado', despachosController.obtenerEstadoDespachos);
router.get('/:idDespacho/detalle', despachosController.obtenerDetalleDespacho);
router.get('/:idDespacho/devoluciones', devolucionesDespachoController.listarDevolucionesPorDespacho);

router.post('/', despachosController.crearDespacho);
router.post('/:idDespacho/devoluciones', devolucionesDespachoController.crearDevolucionDespacho);
router.put('/detalle/:idDetalleDespacho/cantidad', despachosController.actualizarCantidadDespachada);
router.put('/:idDespacho/registrar-cantidades', despachosController.registrarCantidadesDespachoBatch);
router.put('/:idDespacho/finalizar', despachosController.finalizarDespacho);
router.get('/devoluciones/:idDevolucionDespacho/detalle', devolucionesDespachoController.obtenerDetalleDevolucion);

module.exports = router;