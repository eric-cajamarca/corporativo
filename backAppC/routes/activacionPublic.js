/**
 * Rutas públicas solo para activación de empresa (sin auth).
 * Usar únicamente en el flujo de verificación por código WhatsApp.
 * Montar en app.js ANTES de las rutas protegidas.
 */
const express = require('express');
const router = express.Router();
const empresasController = require('../controllers/empresasController');

router.post('/enviar-codigo', empresasController.enviarCodigoActivacion);

module.exports = router;
