const express = require('express');
const api = express.Router();
const comprobantesController = require('../controllers/comprobantesController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD para la tabla Comprobantes
api.get('/comprobantes', auth.auth,comprobantesController.obtener_comprobantes);
api.get('/comprobantes/:id', auth.auth,comprobantesController.obtenerComprobantes_alias);
// api.post('/comprobantes', comprobantesController.createComprobante);
// api.put('/comprobantes/:id', comprobantesController.updateComprobante);
// api.delete('/comprobantes/:id', comprobantesController.deleteComprobante);




module.exports = api;