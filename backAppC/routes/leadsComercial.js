const express = require('express');
const auth = require('../middlewares/autenticate');
const leadsComercialController = require('../controllers/leadsComercial.controller');

const router = express.Router();

router.get('/leads-comercial', auth.auth, leadsComercialController.listar);
router.patch('/leads-comercial/:idLead/estado', auth.auth, leadsComercialController.actualizarEstado);

module.exports = router;
