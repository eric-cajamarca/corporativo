const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacionController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para configuración
router.get('/configuracion', facturacionController.obtenerConfiguracionFacturacion);
router.put('/configuracion', facturacionController.actualizarConfiguracionFacturacion);

// Rutas para comprobantes electrónicos
router.get('/comprobantes', facturacionController.obtenerComprobantesElectronicos);
router.post('/comprobantes', facturacionController.generarComprobanteElectronico);
router.post('/comprobantes/:idComprobanteElectronico/enviar', facturacionController.enviarComprobanteSunat);
router.get('/comprobantes/:idComprobanteElectronico/estado', facturacionController.consultarEstadoSunat);

// Rutas para estadísticas y reportes
router.get('/estadisticas', facturacionController.obtenerEstadisticasFacturacion);

// Rutas para catálogos
router.get('/estados-sunat', facturacionController.obtenerEstadosSunat);

module.exports = router;