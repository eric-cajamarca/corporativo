const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const reservasController = require('../controllers/reservasController');

// Solo rutas /reservas/* (no aplicar a todo /api)
api.use('/reservas', auth.auth);
api.use('/reservas', requireRubro('HOTEL'));

api.get('/reservas', reservasController.listar);
api.get('/reservas/siguiente-codigo', reservasController.siguienteCodigo);
api.get('/reservas/:id', reservasController.obtenerPorId);
api.post('/reservas', reservasController.crear);
api.put('/reservas/:id/cancelar', reservasController.cancelar);
api.put('/reservas/:id', reservasController.actualizar);
api.delete('/reservas/:id', reservasController.eliminar);

module.exports = api;
