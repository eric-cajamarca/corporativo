/**
 * Rutas públicas de empresa (sin auth): registro, verificación y reenvío de código.
 * Montar en app.js como app.use('/api/empresa', empresaPublicRoutes) ANTES de app.use('/api', empresaRouters).
 */
const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');

router.post('/', empresasController.createEmpresa);
router.post('/verificar', empresasController.verificarEmpresaCodigo);
// Envío de código de activación: usar POST /api/activacion/enviar-codigo (activacionPublic.js)

module.exports = router;
