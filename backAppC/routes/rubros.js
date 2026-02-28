const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const rubrosController = require('../controllers/rubrosController');

api.use(auth.auth);

api.get('/rubros', rubrosController.listar);
api.get('/rubros/:id', rubrosController.obtenerPorId);
api.post('/rubros', rubrosController.crear);
api.put('/rubros/:id', rubrosController.actualizar);
api.delete('/rubros/:id', rubrosController.eliminar);
api.get('/rubros/:id/configuracion', rubrosController.listarConfiguracion);
api.put('/rubros/:id/configuracion', rubrosController.guardarConfiguracion);

module.exports = api;
