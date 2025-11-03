var express = require('express');
var api = express.Router();
var dcomprasController = require('../controllers/dcomprasController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de clientes

//api.get('/dcompras',auth.auth, dcomprasController.obtener_detalle_compras_idcompra);
api.get('/dcompras/:id',auth.auth, dcomprasController.obtener_detalle_compras_idcompra);

api.post('/dcompras', auth.auth, dcomprasController.crear_detalle_compras_idcompra);
api.put('/dcompras/:id',auth.auth, dcomprasController.editar_detalle_compras_idcompra);

module.exports = api;
