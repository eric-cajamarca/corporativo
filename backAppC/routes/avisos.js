const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const avisosController = require('../controllers/avisosController');

router.use(auth.auth);

/**
 * GET /api/avisos/cinta
 * Avisos para la cinta (SUNAT, cuotas/cobranza). Solo planes profesional, empresarial y enterprise (SaaS).
 */
router.get('/cinta', avisosController.obtenerCinta);

module.exports = router;
