const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const lotesUbicacionController = require('../controllers/lotesUbicacionController');

api.get('/lote-ubicacion/buscar-productos', auth.auth, lotesUbicacionController.buscarProductosTraslado);
api.get('/lote-ubicacion/producto/:idProducto/lotes', auth.auth, lotesUbicacionController.listarLotesTrasladables);
api.post('/lote-ubicacion/trasladar', auth.auth, lotesUbicacionController.trasladoEntreUbicaciones);
api.get('/lote-ubicacion/lote/:idLote', auth.auth, lotesUbicacionController.getByLote);
api.get('/lote-ubicacion/ubicacion/:idUbicacion', auth.auth, lotesUbicacionController.getByUbicacion);
api.post('/lote-ubicacion', auth.auth, lotesUbicacionController.create);
api.put('/lote-ubicacion', auth.auth, lotesUbicacionController.updateCantidad);
api.delete('/lote-ubicacion/:idLote/:idUbicacion', auth.auth, lotesUbicacionController.deleted);

module.exports = api;