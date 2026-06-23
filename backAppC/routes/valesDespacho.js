const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const valesDespachoController = require('../controllers/valesDespachoController');

api.use(auth.auth);

api.get('/vales-despacho', valesDespachoController.listar);
api.get('/vales-despacho/:id', valesDespachoController.obtenerPorId);
api.post('/vales-despacho', requireRubro('GRF'), valesDespachoController.crear);
api.put('/vales-despacho/:id/anular', requireRubro('GRF'), valesDespachoController.anular);

module.exports = api;
