// SIEMPRE usa rutas RESTful (regla 1.5)
// SIEMPRE aplica middleware de autenticación ANTES de las rutas
var express = require('express');
var api = express.Router();
var permisosController = require('../controllers/permisosController');
var auth= require('../middlewares/autenticate');

// Aplicar middleware de autenticación a todas las rutas


// Rutas de permisos
api.get('/usuario',auth.auth, permisosController.obtener_permisos_usuario);
api.get('/empresa',auth.auth, permisosController.obtener_permisos_empresa);
api.get('/rol/:idRol',auth.auth, permisosController.obtener_permisos_rol);
api.get('/modulos',auth.auth, permisosController.obtener_modulos);
api.get('/navegacion',auth.auth, permisosController.obtener_navegacion_sidebar);

api.post('/',auth.auth, permisosController.crear_permiso);
api.post('/inicializar',auth.auth, permisosController.inicializar_permisos);
api.put('/rol/:idRol',auth.auth, permisosController.actualizar_permisos_rol);

module.exports = api;
