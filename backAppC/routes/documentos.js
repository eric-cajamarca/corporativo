var express = require('express');
var api = express.Router();
var documentoController = require('../controllers/documentoController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de documentos
api.get('/documentos',auth.auth, documentoController.listarDocumentos);
api.post('/documentos',auth.auth, documentoController.crearDocumento);
api.put('/documentos/:idDocumento',auth.auth, documentoController.actualizarDocumento);
api.delete('/documentos/:idDocumento',auth.auth, documentoController.eliminarDocumento);

module.exports = api;