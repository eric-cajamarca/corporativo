const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const valesDespachoController = require('../controllers/valesDespachoController');

api.use(auth.auth);

api.get('/vales-despacho', valesDespachoController.listar);
api.get('/vales-despacho/:id', valesDespachoController.obtenerPorId);
api.post('/vales-despacho', valesDespachoController.crear);
api.put('/vales-despacho/:id/anular', valesDespachoController.anular);

module.exports = api;
