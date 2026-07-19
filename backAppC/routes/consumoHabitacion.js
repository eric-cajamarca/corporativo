const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const consumoHabitacionController = require('../controllers/consumoHabitacionController');

// Solo rutas /consumo-habitacion/* (no aplicar a todo /api)
api.use('/consumo-habitacion', auth.auth);
api.use('/consumo-habitacion', requireRubro('HOTEL'));

api.get('/consumo-habitacion', consumoHabitacionController.listar);
api.post('/consumo-habitacion', consumoHabitacionController.agregar);
api.patch('/consumo-habitacion/:id', consumoHabitacionController.actualizar);
api.delete('/consumo-habitacion/habitacion/:idProductoHabitacion', consumoHabitacionController.limpiarHabitacion);
api.delete('/consumo-habitacion/:id', consumoHabitacionController.eliminar);

module.exports = api;
