const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const consumoHabitacionController = require('../controllers/consumoHabitacionController');

api.use(auth.auth);

api.get('/consumo-habitacion', consumoHabitacionController.listar);
api.post('/consumo-habitacion', consumoHabitacionController.agregar);
api.patch('/consumo-habitacion/:id', consumoHabitacionController.actualizar);
api.delete('/consumo-habitacion/habitacion/:idProductoHabitacion', consumoHabitacionController.limpiarHabitacion);
api.delete('/consumo-habitacion/:id', consumoHabitacionController.eliminar);

module.exports = api;
