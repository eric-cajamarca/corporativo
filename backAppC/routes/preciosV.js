var express = require('express');
var api = express.Router();
var preciosVController = require('../controllers/preciosVController');
var auth  = require('../middlewares/autenticate');


// crearPrecioV,
//     obtenerPrecioV,
//     obtenerPreciosV,
//     actualizarPrecioV

//api.post('/preciosV',auth.auth, preciosVController.crearPrecioV);
api.get('/preciosV/:id',auth.auth, preciosVController.obtenerPrecioV);
api.get('/preciosV',auth.auth, preciosVController.obtenerPreciosV);
api.put('/preciosV/:id',auth.auth, preciosVController.actualizarPrecioV);

api.post('/lista_precios',auth.auth, preciosVController.crear_lista_precio);
api.put('/lista_precios/:id',auth.auth, preciosVController.editar_lista_precio);
api.get('/lista_precios',auth.auth, preciosVController.obtener_listas_precio);
api.delete('/lista_precios/:id',auth.auth, preciosVController.eliminar_lista_precio);
api.post('/precio_producto',auth.auth, preciosVController.crear_precio_producto);
api.put('/precio_producto/:id',auth.auth, preciosVController.editar_precio_producto);
api.get('/precio_producto/:productoId',auth.auth, preciosVController.obtener_precios_producto);
api.delete('/precio_producto/:id',auth.auth, preciosVController.eliminar_precio_producto);

module.exports = api;