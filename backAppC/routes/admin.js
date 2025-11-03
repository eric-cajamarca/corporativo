var express = require('express');
var api = express.Router();
var adminController = require('../controllers/adminController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de ventas
api.get('/admin',auth.auth, adminController.getAdmin);
api.get('/obtener_datos_colaborador_admin/:id',auth.auth, adminController.obtener_datos_colaborador_admin);
api.get('/getEmpresa_login',auth.auth, adminController.getEmpresa_login);
api.post('/admin_login', adminController.admin_login);
api.post('/admin',auth.auth, adminController.createAdmin);
api.put('/admin/:id',auth.auth, adminController.updateAdmin);
api.put('/cambiar_estado_colaborador_admin/:id',auth.auth ,adminController.cambiar_estado_colaborador_admin);

api.post('/logout', auth.auth, adminController.logout);

//api.delete('/admin/:id', adminController.deleteAdmin);

module.exports = api;
