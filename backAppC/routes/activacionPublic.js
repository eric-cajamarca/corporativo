/**
 * Rutas públicas solo para activación de empresa (sin auth).
 * El envío de código de verificación está en empresaPublic.js: POST /api/empresa/enviar-codigo-activacion
 * (usar solo desde pantalla Verificar empresa). Se mantiene este archivo por si se agregan otras rutas de activación.
 */
const express = require('express');
const router = express.Router();

module.exports = router;
