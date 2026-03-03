const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { verificarIntegracion } = require('../middlewares/verificarIntegracion');
const suscripcionController = require('../controllers/suscripcionController');

// Crear pago de suscripción (empresa logueada). Origen izipay o culqi: se exige que la integración esté habilitada.
api.post('/suscripcion/crear-pago', auth.auth, (req, res, next) => {
  const origen = (req.body?.origen || '').toLowerCase();
  if (origen === 'culqi') {
    return verificarIntegracion('culqi')(req, res, next);
  }
  verificarIntegracion('izipay')(req, res, next);
}, suscripcionController.crearPagoSuscripcion);

module.exports = api;
