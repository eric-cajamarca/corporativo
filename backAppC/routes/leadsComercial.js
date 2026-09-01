const express = require('express');
const auth = require('../middlewares/autenticate');
const leadsComercialController = require('../controllers/leadsComercial.controller');

const router = express.Router();

router.get('/leads-comercial/metricas', auth.auth, leadsComercialController.metricas);
router.get('/leads-comercial/revision', auth.auth, leadsComercialController.revision);
router.get('/leads-comercial/:idLead/chat', auth.auth, leadsComercialController.chat);
router.patch('/leads-comercial/:idLead/revision', auth.auth, leadsComercialController.guardarRevision);
router.patch('/leads-comercial/:idLead/estado', auth.auth, leadsComercialController.actualizarEstado);
router.get('/leads-comercial', auth.auth, leadsComercialController.listar);

module.exports = router;
