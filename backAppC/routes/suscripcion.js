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

api.post('/suscripcion/vincular-checkout', auth.auth, suscripcionController.vincularCheckout);
api.get('/suscripcion/planes-catalogo-editor', auth.optionalAuth, suscripcionController.planesCatalogoEditor);
api.put('/suscripcion/planes-catalogo/:planCode', auth.auth, suscripcionController.actualizarPlanCatalogo);
api.get('/suscripcion/mi-estado', auth.auth, suscripcionController.miEstado);
api.post('/suscripcion/solicitar-upgrade', auth.auth, suscripcionController.solicitarUpgrade);

module.exports = api;
