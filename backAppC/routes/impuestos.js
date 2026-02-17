const express = require('express');
const api = express.Router();
const impuestosController = require('../controllers/impuestosController');
const auth = require('../middlewares/autenticate');

api.get('/impuestos', auth.auth, impuestosController.listar);
api.get('/impuestos/codigos-sunat', auth.auth, impuestosController.codigosSunat);
api.get('/impuestos/:id', auth.auth, impuestosController.obtenerPorId);
api.post('/impuestos', auth.auth, impuestosController.crear);
api.put('/impuestos/:id', auth.auth, impuestosController.actualizar);
api.put('/impuestosestado/:id', auth.auth, impuestosController.actualizarEstado);

module.exports = api;
