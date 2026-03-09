const express = require('express');
const router = express.Router();
const facturacionController = require('../controllers/facturacionController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');
const { uploadCertificadoFacturacion } = require('../config/multer.config');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para configuración
router.get('/configuracion', facturacionController.obtenerConfiguracionFacturacion);
router.put('/configuracion', facturacionController.actualizarConfiguracionFacturacion);
router.post('/configuracion/certificado', uploadCertificadoFacturacion, facturacionController.subirCertificadoFacturacion);

// Rutas para comprobantes electrónicos
router.get('/comprobantes', facturacionController.obtenerComprobantesElectronicos);
router.get('/comprobantes/validez', facturacionController.consultarValidezComprobante);
router.post('/comprobantes', facturacionController.generarComprobanteElectronico);
router.get('/comprobantes/origen-para-nota', facturacionController.obtenerOrigenParaNota);
router.get('/comprobantes/buscar-origen', facturacionController.listarComprobantesOrigenPorCliente);
router.get('/comprobantes/:idComprobanteElectronico/origen-para-nota', facturacionController.obtenerOrigenParaNota);
router.post('/comprobantes/:idComprobanteElectronico/enviar', facturacionController.enviarComprobanteSunat);
router.get('/comprobantes/:idComprobanteElectronico/xml', facturacionController.obtenerXmlComprobante);
router.get('/comprobantes/:idComprobanteElectronico/xml-descarga', facturacionController.obtenerXmlComprobanteDescarga);
router.get('/comprobantes/:idComprobanteElectronico/cdr', facturacionController.obtenerCdrComprobante);
router.post('/notas-crecimiento', facturacionController.crearNotaCreditoDebito);
router.get('/comunicacion-baja/comprobantes', facturacionController.listarComprobantesParaBaja);
router.get('/comunicacion-baja/motivos', facturacionController.listarMotivosBaja);
router.get('/comunicacion-baja', facturacionController.listarComunicacionesBaja);
router.post('/comunicacion-baja/enviar', facturacionController.enviarComunicacionBaja);
router.post('/comunicacion-baja/:idComunicacionBaja/consultar-estado', facturacionController.consultarEstadoComunicacionBaja);
router.post('/enviar-lote', facturacionController.enviarLoteSunat);
router.get('/comprobantes/:idComprobanteElectronico/estado', facturacionController.consultarEstadoSunat);

// Resumen diario (RC)
router.get('/resumenes-diarios', facturacionController.listarResumenesDiarios);
router.get('/resumenes-diarios/boletas-pendientes', facturacionController.obtenerBoletasPendientesResumen);
router.post('/resumenes-diarios/enviar', facturacionController.enviarResumenDiario);
router.post('/resumenes-diarios/:idResumenDiarioSunat/consultar-estado', facturacionController.consultarEstadoResumenDiario);

// Rutas para estadísticas y reportes
router.get('/estadisticas', facturacionController.obtenerEstadisticasFacturacion);

// Rutas para catálogos
router.get('/estados-sunat', facturacionController.obtenerEstadosSunat);

// Validación de credenciales SOL (descifrado + certificado PFX)
router.get('/validar-credenciales-sol', facturacionController.validarCredencialesSol);

module.exports = router;