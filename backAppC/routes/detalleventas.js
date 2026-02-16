const express = require('express');
const api = express.Router();
const dventasController = require('../controllers/dventasController');
const ventasController = require('../controllers/ventasController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de ventas
api.get('/ventas', dventasController.obtenerDetalleVentas);
api.get('/ventas/listar', auth.auth, ventasController.obtenerVentas);
api.get('/ventas/comprobante/:idVenta', auth.auth, ventasController.obtenerComprobanteParaPdf);
api.put('/ventas/editar/:idVenta', auth.auth, ventasController.actualizarVentaEdicion);
// api.get('/dventas/:id', auth.auth, dventasController.obtenerDetalleVentaPorId);
api.get('/ventas/:id/:idempresa', auth.auth, dventasController.obtenerDetalleVentaPorId_empresa);
// api.post('/ventas', ventasController.crearVenta);
api.post('/ventas/completa', auth.auth, ventasController.crearVentaCompleta);
api.put('/ventas/:id', auth.auth, dventasController.actualizarDetalleVenta);
api.delete('/ventas/:id', dventasController.eliminarDetalleVenta);

module.exports = api;
