const express = require('express');
const api = express.Router();
const dventasController = require('../controllers/dventasController');
const ventasController = require('../controllers/ventasController');
const detalleVentaEntregaController = require('../controllers/detalleVentaEntregaController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de ventas (todas con auth excepto las que requieren acceso público)
// Entregas parciales (DetalleVentaEntrega) - deben ir antes de /ventas/:id/:idempresa
api.get('/ventas/:idVenta/entregas', auth.auth, detalleVentaEntregaController.listarPorVenta);
api.post('/ventas/entregas', auth.auth, detalleVentaEntregaController.crear);

api.get('/ventas', auth.auth, dventasController.obtenerDetalleVentas);
api.get('/ventas/listar', auth.auth, ventasController.obtenerVentas);
api.get('/ventas/config-defaults', auth.auth, ventasController.getConfigDefaults);
api.put('/ventas/config-defaults', auth.auth, ventasController.putConfigDefaults);
api.get('/ventas/pendientes-pago', auth.auth, ventasController.getPendientesPago);
api.get('/ventas/comprobante/:idVenta', auth.auth, ventasController.obtenerComprobanteParaPdf);
api.put('/ventas/editar/:idVenta', auth.auth, ventasController.actualizarVentaEdicion);
api.post('/ventas/:idVenta/cobrar', auth.auth, ventasController.postCobrarVenta);
api.get('/ventas/:id/:idempresa', auth.auth, dventasController.obtenerDetalleVentaPorId_empresa);
api.post('/ventas/completa', auth.auth, ventasController.crearVentaCompleta);
api.put('/ventas/:id', auth.auth, dventasController.actualizarDetalleVenta);
api.delete('/ventas/:id', auth.auth, dventasController.eliminarDetalleVenta);

module.exports = api;
