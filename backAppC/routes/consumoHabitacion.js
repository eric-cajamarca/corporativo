const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const consumoHabitacionController = require('../controllers/consumoHabitacionController');

api.use(auth.auth);

api.get('/consumo-habitacion', consumoHabitacionController.listar);
api.post('/consumo-habitacion', requireRubro('HOTEL'), consumoHabitacionController.agregar);
api.patch('/consumo-habitacion/:id', requireRubro('HOTEL'), consumoHabitacionController.actualizar);
api.delete('/consumo-habitacion/habitacion/:idProductoHabitacion', requireRubro('HOTEL'), consumoHabitacionController.limpiarHabitacion);
api.delete('/consumo-habitacion/:id', requireRubro('HOTEL'), consumoHabitacionController.eliminar);

module.exports = api;
