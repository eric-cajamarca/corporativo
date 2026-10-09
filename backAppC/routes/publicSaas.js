const express = require('express');
const rateLimit = require('express-rate-limit');
const suscripcionPublicController = require('../controllers/suscripcionPublicController');
const deploymentPublicController = require('../controllers/deploymentPublicController');
const chatComercialPublicoController = require('../controllers/chatComercialPublico.controller');
const externalController = require('../controllers/externalController');

const api = express.Router();

// Lectura pública de planes y configuración: límite amplio para no bloquear navegación ni campañas
const limiterLectura = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
});

// Polling de estado de checkout durante el proceso de pago
const limiterPolling = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});

// Consultas de RUC y acciones de checkout
const limiterOperativo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false
});

const limiterCulqi = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

const limiterChat = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas consultas en poco tiempo. Espere unos momentos.' }
});

api.post('/public/chat-comercial', limiterChat, chatComercialPublicoController.chatear);
api.get('/public/ruc/:ruc', limiterOperativo, externalController.getRucPublico);
api.get('/public/config/deployment', limiterLectura, deploymentPublicController.getDeploymentConfig);
api.get('/public/planes', limiterLectura, suscripcionPublicController.listarPlanes);
api.post('/public/suscripcion/resumen-checkout', limiterOperativo, suscripcionPublicController.resumenCheckout);
api.post('/public/suscripcion/iniciar-checkout', limiterOperativo, suscripcionPublicController.iniciarCheckout);
api.post('/public/suscripcion/confirmar-demo', limiterOperativo, suscripcionPublicController.confirmarDemo);
api.post('/public/suscripcion/confirmar-culqi', limiterCulqi, suscripcionPublicController.confirmarCulqi);
api.post('/public/suscripcion/reportar-pago-manual', limiterOperativo, suscripcionPublicController.reportarPagoManual);
api.get('/public/suscripcion/checkout/:orderNumber/estado', limiterPolling, suscripcionPublicController.estadoCheckout);

module.exports = api;
