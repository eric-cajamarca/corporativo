var express = require('express');
var api = express.Router();
var direccionClientesController = require('../controllers/direccionClientesController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de direccionClientes
api.get('/direccionClientes',auth.auth, direccionClientesController.listarDireccionClientes);
api.get('/direccionesClientes/:id',auth.auth, direccionClientesController.listarDireccionesClientes_idCliente);
api.post('/direccionClientes',auth.auth, direccionClientesController.crearDireccionCliente);
api.put('/direccionClientes/:id',auth.auth, direccionClientesController.actualizarDireccionCliente);
api.delete('/direccionClientes/:id',auth.auth, direccionClientesController.eliminarDireccionCliente);

module.exports = api;
