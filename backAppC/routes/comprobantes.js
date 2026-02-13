const express = require('express');
const api = express.Router();
const comprobantesController = require('../controllers/comprobantesController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD para la tabla Comprobantes
api.get('/comprobantes', auth.auth, comprobantesController.obtener_comprobantes);
api.get('/comprobantes/:id', auth.auth, comprobantesController.obtenerComprobantes_alias);
api.put('/comprobantes/:id', auth.auth, comprobantesController.actualizar_comprobante);
api.post('/comprobantes', auth.auth, comprobantesController.crear_comprobante);




module.exports = api;