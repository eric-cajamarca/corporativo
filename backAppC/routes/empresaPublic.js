/**
 * Rutas públicas de empresa (sin auth): registro, verificación y reenvío de código.
 * Montar en app.js como app.use('/api/empresa', empresaPublicRoutes) ANTES de app.use('/api', empresaRouters).
 */
const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');

router.post('/', empresasController.createEmpresa);
router.post('/verificar', empresasController.verificarEmpresaCodigo);
/** Envío de código de activación por WhatsApp (solo desde pantalla Verificar empresa). Ruta pública, sin auth. */
router.post('/enviar-codigo-activacion', empresasController.enviarCodigoActivacion);

module.exports = router;
