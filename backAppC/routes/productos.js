var express = require('express');
var api = express.Router();
var productosController = require('../controllers/productosController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de clientes
api.get('/productos',auth.auth, productosController.obtener_productos_todos);
api.get('/productos/:id',auth.auth, productosController.obtener_productos_id);
api.post('/productos', auth.auth, productosController.crear_producto);
api.put('/productos/:id',auth.auth, productosController.actualizar_producto);
api.delete('/productos/:id',auth.auth, productosController.eliminar_producto);


module.exports = api;
