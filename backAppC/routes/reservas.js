const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const reservasController = require('../controllers/reservasController');

api.use(auth.auth);

api.get('/reservas', reservasController.listar);
api.get('/reservas/siguiente-codigo', reservasController.siguienteCodigo);
api.get('/reservas/:id', reservasController.obtenerPorId);
api.post('/reservas', reservasController.crear);
api.put('/reservas/:id', reservasController.actualizar);
api.delete('/reservas/:id', reservasController.eliminar);

module.exports = api;
