var express = require('express');
var api = express.Router();
var clientesController = require('../controllers/clientesController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de clientes
api.get('/clientes',auth.auth, clientesController.listarClientes);
api.get('/clientesruc/:id',auth.auth, clientesController.listarClientes_ruc);
api.get('/clientes/:id',auth.auth, clientesController.listarClientes_id);
api.post('/clientes', auth.auth, clientesController.crearCliente);
api.put('/clientes/:id',auth.auth, clientesController.actualizarCliente);
api.put('/cambiar_estado_clientes/:id',auth.auth ,clientesController.cambiarEstadoCliente);
api.delete('/clientes/:id',auth.auth, clientesController.eliminarCliente);

module.exports = api;


