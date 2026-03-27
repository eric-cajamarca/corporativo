var express = require('express');
var api = express.Router();
var adminController = require('../controllers/adminController');
var auth  = require('../middlewares/autenticate');
const { adminLoginRateLimiter } = require('../middlewares/loginRateLimit');

// Rutas para el CRUD de ventas
api.get('/admin',auth.auth, adminController.getAdmin);
api.get('/obtener_datos_colaborador_admin/:id',auth.auth, adminController.obtener_datos_colaborador_admin);
api.get('/getEmpresa_login', auth.optionalAuth, adminController.getEmpresa_login);
api.post('/admin_login', adminLoginRateLimiter, adminController.admin_login);
api.post('/admin_2fa_setup_init', adminLoginRateLimiter, adminController.admin_2fa_setup_init);
api.post('/admin_2fa_setup_confirm', adminLoginRateLimiter, adminController.admin_2fa_setup_confirm);
api.post('/admin_2fa_verify', adminLoginRateLimiter, adminController.admin_2fa_verify);
api.post('/refresh_session', adminController.refresh_session);
api.post('/recuperar-password', adminController.recuperarPassword);
api.post('/restablecer-password', adminController.restablecerPassword);
api.post('/admin',auth.auth, adminController.createAdmin);
api.put('/admin/:id',auth.auth, adminController.updateAdmin);
api.put('/cambiar_estado_colaborador_admin/:id',auth.auth ,adminController.cambiar_estado_colaborador_admin);

api.post('/logout', auth.optionalAuth, adminController.logout);

//api.delete('/admin/:id', adminController.deleteAdmin);

module.exports = api;
