var express = require('express');
var api = express.Router();
var proveedoresController = require('../controllers/proveedorController');

var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de clientes
api.get('/proveedores',auth.auth, proveedoresController.listarProveedores);
api.get('/proveedoresruc/:id',auth.auth, proveedoresController.listarProveedores_ruc);
api.get('/proveedores/:id',auth.auth, proveedoresController.listarProveedores_id);
api.post('/proveedores', auth.auth, proveedoresController.crearProveedor);
api.put('/proveedores/:id',auth.auth, proveedoresController.actualizarProveedor);
api.put('/cambiar_estado_Proveedores/:id',auth.auth ,proveedoresController.cambiarEstadoProveedor);
api.delete('/proveedores/:id',auth.auth, proveedoresController.eliminarProveedor);


//direcciones
api.get('/direccionProveedores',auth.auth, proveedoresController.listarDireccionProveedores);
api.get('/direccionesProveedores/:id',auth.auth, proveedoresController.listarDirecciones_idProveedor);
api.post('/direccionProveedores',auth.auth, proveedoresController.crearDireccionProveedor);
api.put('/direccionProveedores/:id',auth.auth, proveedoresController.actualizarDireccionProveedor);
api.delete('/direccionProveedores/:id',auth.auth, proveedoresController.eliminarDireccionProveedor);

module.exports = api;

