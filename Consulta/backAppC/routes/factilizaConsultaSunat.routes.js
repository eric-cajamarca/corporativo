/**
 * Rutas mínimas: consulta CPE SUNAT vía Factiliza (XML crudo, JSON normalizado, PDF).
 * En EFAF2026 van montadas junto con otras rutas en routes/factiliza.js; aquí queda la copia
 * lista para app.use('/api', router) en otro proyecto.
 */
const express = require('express');
const factilizaController = require('../controllers/factilizaController');
const auth = require('../middlewares/autenticate');

const api = express.Router();

api.post('/consultar-comprobante-sunat', auth.auth, factilizaController.consultarComprobanteSunat);
api.post('/xml', auth.auth, factilizaController.getXmlSunat);
api.post('/factiliza/pdf', auth.auth, factilizaController.consultarComprobantePdf);

module.exports = api;
