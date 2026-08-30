const express = require('express');
const auth = require('../middlewares/autenticate');
const leadsComercialController = require('../controllers/leadsComercial.controller');

const router = express.Router();

router.use(auth.auth);
router.get('/leads-comercial', leadsComercialController.listar);
router.patch('/leads-comercial/:idLead/estado', leadsComercialController.actualizarEstado);

module.exports = router;
