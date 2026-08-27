const express = require('express');
const rateLimit = require('express-rate-limit');
const suscripcionPublicController = require('../controllers/suscripcionPublicController');
const deploymentPublicController = require('../controllers/deploymentPublicController');

const api = express.Router();

const limiterSuave = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  standardHeaders: true,
  legacyHeaders: false
});

const limiterCulqi = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

api.get('/public/config/deployment', limiterSuave, deploymentPublicController.getDeploymentConfig);
api.get('/public/planes', limiterSuave, suscripcionPublicController.listarPlanes);
api.post('/public/suscripcion/resumen-checkout', limiterSuave, suscripcionPublicController.resumenCheckout);
api.post('/public/suscripcion/iniciar-checkout', limiterSuave, suscripcionPublicController.iniciarCheckout);
api.post('/public/suscripcion/confirmar-demo', limiterSuave, suscripcionPublicController.confirmarDemo);
api.post('/public/suscripcion/confirmar-culqi', limiterCulqi, suscripcionPublicController.confirmarCulqi);
api.post('/public/suscripcion/reportar-pago-manual', limiterSuave, suscripcionPublicController.reportarPagoManual);
api.get('/public/suscripcion/checkout/:orderNumber/estado', limiterSuave, suscripcionPublicController.estadoCheckout);

module.exports = api;
