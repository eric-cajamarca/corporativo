// routes/cotizaciones.js
const express = require('express');
const api = express.Router();
const cotizacionesController = require('../controllers/cotizacionesController');
const auth = require('../middlewares/autenticate');

api.post('/', auth.auth, cotizacionesController.crear);
api.get('/', auth.auth, cotizacionesController.listar);
api.get('/:id/pdf', auth.auth, cotizacionesController.obtenerParaPdf);
api.get('/:id/para-venta', auth.auth, cotizacionesController.obtenerParaVenta);
api.get('/:id', auth.auth, cotizacionesController.obtenerPorId);
api.put('/:id', auth.auth, cotizacionesController.actualizar);
api.delete('/:id', auth.auth, cotizacionesController.eliminar);

module.exports = api;
