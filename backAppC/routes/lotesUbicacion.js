const express = require('express');
const api = express.Router();
const lotesUbicacionController = require('../controllers/lotesUbicacionController');

api.get('/lote-ubicacion/lote/:idLote', lotesUbicacionController.getByLote);
api.get('/lote-ubicacion/ubicacion/:idUbicacion', lotesUbicacionController.getByUbicacion);
api.post('/lote-ubicacion', lotesUbicacionController.create);
api.put('/lote-ubicacion', lotesUbicacionController.updateCantidad);
api.delete('/lote-ubicacion/:idLote/:idUbicacion', lotesUbicacionController.deleted);

module.exports = api;