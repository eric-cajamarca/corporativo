const express = require('express');
const api = express.Router();
const multer = require('multer'); // <-- Nueva dependencia

// Configura multer para guardar archivos en './uploads/configuraciones'
const upload = multer({ dest: './uploads/configuraciones' });
const empresasController = require('../controllers/empresasController');
var auth  = require('../middlewares/autenticate');
const { uploadLogo } = require('../config/multer.config');

// Rutas para la gestión de empresas
// READ
api.get('/empresa', auth.auth, empresasController.getEmpresas);
api.post('/empresa/:idEmpresa/reset-2fa-admin', auth.auth, empresasController.reset2faEmpresa);
api.put('/empresa/:idEmpresa/politica-2fa-admin', auth.auth, empresasController.putPolitica2faAdmin);
api.get('/empresaid',auth.auth, empresasController.getEmpresasById);
api.get('/empresas_id',auth.auth, empresasController.getEmpresa_id);
api.get('/obtener_logo/:img', empresasController.obtener_logo);
// Ruta pública para crear empresa (registro SaaS). No requiere auth.
api.post('/empresa', empresasController.createEmpresa);
// Ruta pública para verificar empresa con código enviado por WhatsApp.
api.post('/empresa/verificar', empresasController.verificarEmpresaCodigo);
// Envío de código de activación: ruta pública en empresaPublic.js (POST /api/empresa/enviar-codigo-activacion).
//api.put('/empresa/:id',[auth.auth,path], empresasController.updateEmpresa);
api.put('/empresa/:id', auth.auth,uploadLogo, empresasController.updateEmpresa); // Cambia 'archivo' por el nombre del campo del formulario
api.put('/cambiar_estado_empresa/:id',auth.auth, empresasController.cambiar_estado_empresa);
api.delete('/direccion_empresa/:id',auth.auth, empresasController.deleteDireccion_id);



api.get('/direccionempresa',auth.auth, empresasController.getDireccionEmpresa_id);
api.post('/direccion_empresa', auth.auth, empresasController.createDireccionEmpresa);
api.post('/sucursal', auth.auth, empresasController.createSucursalEmpresa);
api.put('/direccion_empresa/:id',auth.auth, empresasController.updateDireccionEmpresa);
api.put('/cambiar_principal/:id',auth.auth, empresasController.cambiar_principal_direccion);

// Estado de configuración de la empresa
api.get('/estado_configuracion',auth.auth, empresasController.getEstadoConfiguracion);

// Integraciones y APIs de pago (empresa del usuario logueado)
api.get('/empresa/integraciones', auth.auth, empresasController.getIntegraciones);
api.put('/empresa/integraciones', auth.auth, empresasController.putIntegraciones);
api.put('/empresa/integraciones/credenciales', auth.auth, empresasController.putCredencialesProveedor);

module.exports = api;