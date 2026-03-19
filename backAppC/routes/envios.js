const express = require('express');
const router = express.Router();
const enviosController = require('../controllers/enviosController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para gestión de envíos
router.get('/', enviosController.obtenerEnviosProgramados);
router.get('/venta/:idVenta', enviosController.obtenerEnviosVenta);
router.post('/', enviosController.crearEnvio);
router.get('/:idEnvio/detalle', enviosController.obtenerDetalleEnvio);
router.put('/:idEnvio', enviosController.actualizarEnvio);
router.delete('/:idEnvio', enviosController.eliminarEnvio);
router.put('/:idEnvio/estado', enviosController.actualizarEstadoEnvio);
router.put('/:idEnvio/transportista', enviosController.asignarTransportista);
router.get('/mis-envios', enviosController.obtenerEnviosMisChoferes);

// Transportistas (delivery externo) - permite registrar externos cuando no hay choferes internos.
router.post('/transportistas', enviosController.crearTransportista);

// Rutas para catálogos
router.get('/transportistas', enviosController.obtenerTransportistas);
router.get('/tipos', enviosController.obtenerTiposEnvio);
router.get('/estados', enviosController.obtenerEstadosEnvio);

// Rutas para consultas específicas
router.get('/por-estado', enviosController.obtenerEnviosPorEstado);
router.get('/transportista/:idTransportista', enviosController.obtenerEnviosPorTransportista);

module.exports = router;