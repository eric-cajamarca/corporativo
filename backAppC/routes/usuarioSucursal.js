// SIEMPRE usa rutas RESTful (regla 1.5)
// SIEMPRE aplica middleware de autenticación ANTES de las rutas
const express = require('express');
const api = express.Router();
const usuarioSucursalController = require('../controllers/usuarioSucursalController');
const auth = require('../middlewares/autenticate');

// Aplicar middleware de autenticación
api.use(auth.auth);

// Rutas del usuario actual
api.get('/mis-sucursales', usuarioSucursalController.obtener_mis_sucursales);
api.get('/mi-sucursal-default', usuarioSucursalController.obtener_sucursal_default);
api.put('/sucursal-default', usuarioSucursalController.establecer_sucursal_default);

// Rutas de gestión (admin)
api.get('/usuario/:idUsuario', usuarioSucursalController.obtener_sucursales_usuario);
api.get('/usuario/:idUsuario/asignacion', usuarioSucursalController.obtener_sucursales_con_asignacion);
api.get('/sucursal/:idSucursal/usuarios', usuarioSucursalController.obtener_usuarios_sucursal);
api.get('/verificar/:idSucursal', usuarioSucursalController.verificar_acceso);
api.post('/', usuarioSucursalController.asignar_usuario_sucursal);
api.put('/asignaciones', usuarioSucursalController.actualizar_asignaciones);
api.delete('/:idUsuarioSucursal', usuarioSucursalController.desasignar_usuario_sucursal);

module.exports = api;
