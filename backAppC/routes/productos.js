var express = require('express');
var api = express.Router();
var productosController = require('../controllers/productosController');
var productosImagenController = require('../controllers/productosImagen.controller');
var auth = require('../middlewares/autenticate');
var multerConfig = require('../config/multer.config');

// Rutas CRUD productos (habitaciones antes de :id)
api.get('/productos', auth.auth, productosController.obtener_productos_todos);
api.get('/productos/compras', auth.auth, productosController.obtener_productos_compras);
api.get('/productos/habitaciones', auth.auth, productosController.obtener_productos_habitacion);
api.post('/productos/match-descripcion', auth.auth, productosController.match_productos_descripcion);
// Imágenes de producto (antes de /productos/:id para que no capture "imagenes" como id)
api.get('/productos/:idProducto/imagenes', auth.auth, productosImagenController.listar);
api.post('/productos/:idProducto/imagenes', auth.auth, multerConfig.uploadImagenesProducto, productosImagenController.subir);
api.delete('/productos/imagenes/:idImagen', auth.auth, productosImagenController.eliminar);
// CRUD por id
api.get('/productos/:id', auth.auth, productosController.obtener_productos_id);
api.post('/productos', auth.auth, productosController.crear_producto);
api.put('/productos/:id', auth.auth, productosController.actualizar_producto);
api.delete('/productos/:id', auth.auth, productosController.eliminar_producto);

module.exports = api;
