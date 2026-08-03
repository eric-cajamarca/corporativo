const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const catalogoFormaPagoController = require('../controllers/catalogoFormaPagoController');
const catalogoTipoMovimientoController = require('../controllers/catalogoTipoMovimientoController');
const clasificacionConceptoController = require('../controllers/clasificacionConceptoController');
const conceptoController = require('../controllers/conceptoController');
const motivoTrasladoController = require('../controllers/motivoTrasladoController');
const motivoNotaCreditoController = require('../controllers/motivoNotaCreditoController');
const motivoNotaDebitoController = require('../controllers/motivoNotaDebitoController');

api.use(auth.auth);

// Forma Pago
api.get('/forma-pago', catalogoFormaPagoController.listar);
api.get('/forma-pago/:id', catalogoFormaPagoController.obtenerPorId);
api.post('/forma-pago', catalogoFormaPagoController.crear);
api.put('/forma-pago/:id', catalogoFormaPagoController.actualizar);
api.delete('/forma-pago/:id', catalogoFormaPagoController.eliminar);

// Tipo Movimientos
api.get('/tipo-movimientos', catalogoTipoMovimientoController.listar);
api.get('/tipo-movimientos/:id', catalogoTipoMovimientoController.obtenerPorId);
api.post('/tipo-movimientos', catalogoTipoMovimientoController.crear);
api.put('/tipo-movimientos/:id', catalogoTipoMovimientoController.actualizar);
api.delete('/tipo-movimientos/:id', catalogoTipoMovimientoController.eliminar);

// Clasificación Conceptos
api.get('/clasificacion-conceptos', clasificacionConceptoController.listar);
api.get('/clasificacion-conceptos/:id', clasificacionConceptoController.obtenerPorId);
api.post('/clasificacion-conceptos', clasificacionConceptoController.crear);
api.put('/clasificacion-conceptos/:id', clasificacionConceptoController.actualizar);
api.delete('/clasificacion-conceptos/:id', clasificacionConceptoController.eliminar);

// Conceptos
api.get('/conceptos', conceptoController.listar);
api.get('/conceptos/:id', conceptoController.obtenerPorId);
api.post('/conceptos', conceptoController.crear);
api.put('/conceptos/:id', conceptoController.actualizar);
api.delete('/conceptos/:id', conceptoController.eliminar);

// Motivo Traslado (catálogo SUNAT HandlingCode GRE)
api.get('/motivo-traslado/codigos-sunat', motivoTrasladoController.codigosSunat);
api.get('/motivo-traslado', motivoTrasladoController.listar);
api.get('/motivo-traslado/:id', motivoTrasladoController.obtenerPorId);
api.post('/motivo-traslado', motivoTrasladoController.crear);
api.put('/motivo-traslado/:id', motivoTrasladoController.actualizar);
api.delete('/motivo-traslado/:id', motivoTrasladoController.eliminar);

// Motivo Nota Crédito (Catálogo 09 SUNAT)
api.get('/motivo-nota-credito', motivoNotaCreditoController.listar);
api.get('/motivo-nota-credito/codigos-sunat', motivoNotaCreditoController.codigosSunat);
api.get('/motivo-nota-credito/:id', motivoNotaCreditoController.obtenerPorId);
api.post('/motivo-nota-credito', motivoNotaCreditoController.crear);
api.put('/motivo-nota-credito/:id', motivoNotaCreditoController.actualizar);
api.delete('/motivo-nota-credito/:id', motivoNotaCreditoController.eliminar);

// Motivo Nota Débito (Catálogo 10 SUNAT)
api.get('/motivo-nota-debito', motivoNotaDebitoController.listar);
api.get('/motivo-nota-debito/codigos-sunat', motivoNotaDebitoController.codigosSunat);
api.get('/motivo-nota-debito/:id', motivoNotaDebitoController.obtenerPorId);
api.post('/motivo-nota-debito', motivoNotaDebitoController.crear);
api.put('/motivo-nota-debito/:id', motivoNotaDebitoController.actualizar);
api.delete('/motivo-nota-debito/:id', motivoNotaDebitoController.eliminar);

module.exports = api;
