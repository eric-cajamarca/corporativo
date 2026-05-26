var express = require('express');
var api = express.Router();
var adminController = require('../controllers/adminController');
var auth  = require('../middlewares/autenticate');
const {
  adminLoginRateLimiter,
  adminMfaRateLimiter,
  recuperarPasswordRateLimiter,
  restablecerPasswordRateLimiter
} = require('../middlewares/loginRateLimit');

// Rutas para el CRUD de ventas
api.get('/admin',auth.auth, adminController.getAdmin);
api.get('/obtener_datos_colaborador_admin/:id',auth.auth, adminController.obtener_datos_colaborador_admin);
api.get('/getEmpresa_login', auth.optionalAuth, adminController.getEmpresa_login);
api.post('/admin_login', adminLoginRateLimiter, adminController.admin_login);
api.post('/admin_2fa_setup_init', adminMfaRateLimiter, adminController.admin_2fa_setup_init);
api.post('/admin_2fa_setup_confirm', adminMfaRateLimiter, adminController.admin_2fa_setup_confirm);
api.post('/admin_2fa_verify', adminMfaRateLimiter, adminController.admin_2fa_verify);
api.post('/refresh_session', adminController.refresh_session);
api.get('/session_alive', auth.auth, adminController.sessionAlive);
api.get('/sesiones_dispositivos', auth.auth, adminController.listarSesionesDispositivos);
api.delete('/sesiones_dispositivos/:idRefresh', auth.auth, adminController.revocarSesionDispositivo);
api.post('/sesiones_dispositivos/revocar_otras', auth.auth, adminController.revocarOtrasSesionesDispositivos);
api.post('/recuperar-password', recuperarPasswordRateLimiter, adminController.recuperarPassword);
api.post(
  '/restablecer-password',
  restablecerPasswordRateLimiter,
  adminController.restablecerPassword
);
api.post('/admin',auth.auth, adminController.createAdmin);
api.put('/admin/:id',auth.auth, adminController.updateAdmin);
api.put('/cambiar_estado_colaborador_admin/:id',auth.auth ,adminController.cambiar_estado_colaborador_admin);

api.post('/logout', auth.optionalAuth, adminController.logout);

//api.delete('/admin/:id', adminController.deleteAdmin);

module.exports = api;
