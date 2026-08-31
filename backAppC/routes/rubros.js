const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const rubrosController = require('../controllers/rubrosController');

api.get('/rubros', auth.auth, rubrosController.listar);
api.get('/rubros/:id', auth.auth, rubrosController.obtenerPorId);
api.post('/rubros', auth.auth, rubrosController.crear);
api.put('/rubros/:id', auth.auth, rubrosController.actualizar);
api.delete('/rubros/:id', auth.auth, rubrosController.eliminar);
api.get('/rubros/:id/configuracion', auth.auth, rubrosController.listarConfiguracion);
api.put('/rubros/:id/configuracion', auth.auth, rubrosController.guardarConfiguracion);

module.exports = api;
