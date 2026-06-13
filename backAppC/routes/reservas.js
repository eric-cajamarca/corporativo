const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const reservasController = require('../controllers/reservasController');

api.use(auth.auth);

api.get('/reservas', reservasController.listar);
api.get('/reservas/siguiente-codigo', reservasController.siguienteCodigo);
api.get('/reservas/:id', reservasController.obtenerPorId);
api.post('/reservas', requireRubro('HOTEL'), reservasController.crear);
api.put('/reservas/:id', requireRubro('HOTEL'), reservasController.actualizar);
api.delete('/reservas/:id', requireRubro('HOTEL'), reservasController.eliminar);

module.exports = api;
