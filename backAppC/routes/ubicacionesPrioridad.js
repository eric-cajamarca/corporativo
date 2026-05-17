const express = require('express');
const api = express.Router();
const auth  = require('../middlewares/autenticate');
const ubicacionesPrioridadController = require('../controllers/ubicacionePrioridadController');

api.get('/ubicaciones-prioridad',auth.auth, ubicacionesPrioridadController.getAll);
api.get('/ubicaciones-prioridad/codigos-consolidados',auth.auth, ubicacionesPrioridadController.listarCodigosConsolidados);
api.get('/ubicaciones-prioridad/sucursal/:idSucursal',auth.auth, ubicacionesPrioridadController.getBySucursal);
api.post('/ubicaciones-prioridad',auth.auth, ubicacionesPrioridadController.create);
api.put('/ubicaciones-prioridad/:idUbicacion',auth.auth, ubicacionesPrioridadController.update);
api.delete('/ubicaciones-prioridad/:idUbicacion',auth.auth, ubicacionesPrioridadController.deleted);

module.exports = api;