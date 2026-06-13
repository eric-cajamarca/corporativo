const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const grifoController = require('../controllers/grifoController');

api.use(auth.auth);
api.use(requireRubro('GRF'));

api.get('/grifo/tanques', grifoController.listarTanques);
api.put('/grifo/tanques/:id', grifoController.actualizarTanque);
api.post('/grifo/tanques', grifoController.crearTanque);
api.get('/grifo/resumen', grifoController.resumen);
api.get('/grifo/productos-combustibles', grifoController.productosCombustibles);

module.exports = api;
