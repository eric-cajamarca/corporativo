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
api.get('/empresaid',auth.auth, empresasController.getEmpresasById);
api.get('/obtener_logo/:img', empresasController.obtener_logo);
api.post('/empresa', empresasController.createEmpresa);
//api.put('/empresa/:id',[auth.auth,path], empresasController.updateEmpresa);
api.put('/empresa/:id', auth.auth,uploadLogo, empresasController.updateEmpresa); // Cambia 'archivo' por el nombre del campo del formulario
api.put('/cambiar_estado_empresa/:id',auth.auth, empresasController.cambiar_estado_empresa);
api.delete('/direccion_empresa/:id',auth.auth, empresasController.deleteDireccion_id);



api.get('/direccionempresa',auth.auth, empresasController.getDireccionEmpresa_id);
api.post('/direccion_empresa', empresasController.createDireccionEmpresa);
api.put('/direccion_empresa/:id',auth.auth, empresasController.updateDireccionEmpresa);
api.put('/cambiar_principal/:id',auth.auth, empresasController.cambiar_principal_direccion);



module.exports = api;