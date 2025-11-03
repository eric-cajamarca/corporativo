var express = require('express');
var api = express.Router();
var sucursalController = require('../controllers/sucursalController');
var auth  = require('../middlewares/autenticate');
// obtener_stock_productos_sucursal
api.get('/sucursal',auth.auth, sucursalController.obtener_sucursal_todos);
api.get('/sucursalempresa/',auth.auth, sucursalController.obtener_sucursal_idempresa);
//api.post('/sucursal', auth.auth, sucursalController.crear_sucursal_idEmpresa);
api.put('/sucursal/:id',auth.auth, sucursalController.editar_sucursal_idEmpresa);
api.put('/sucursalestado/:id',auth.auth, sucursalController.editar_estado_idsucursal);
api.delete('/sucursal/:id',auth.auth, sucursalController.eliminar_sucursal_idempresa);

//////////////////////////////////////////////////////////////////////////////////////////
// obtener_stock_sucursal_idProducto,
//     obtener_stock_sucursales_idempresa,
//     crear_stock_sucursal_idEmpresa,
//     editar_stock_sucursal,
//     eliminar_stock_sucursal

api.get('/stocksucursal',auth.auth, sucursalController.obtener_stock_sucursal_idProducto);
api.get('/stocksucursales/',auth.auth, sucursalController.obtener_stock_sucursales_idempresa);
api.post('/stocksucursal', auth.auth, sucursalController.crear_stock_sucursal_idEmpresa);
api.put('/stocksucursal/:id',auth.auth, sucursalController.editar_stock_sucursal);
api.delete('/stocksucursal/:id',auth.auth, sucursalController.eliminar_stock_sucursal);

module.exports = api;
