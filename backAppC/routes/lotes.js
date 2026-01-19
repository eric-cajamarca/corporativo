const express = require('express');
const api = express.Router();
var auth  = require('../middlewares/autenticate');
const lotesController = require('../controllers/lotesController');

api.get('/lote', auth.auth,lotesController.getAll);
api.get('/lote/:idLote',auth.auth, lotesController.getById);
api.get('/lotesucursal/:idSucursal',auth.auth, lotesController.getBySucursal);
api.post('/lote',auth.auth, lotesController.create);
api.put('/lote/:idLote', auth.auth,lotesController.update);
api.delete('/lote/:idLote',auth.auth, lotesController.deleted);
api.put('/lote/:idLote/disponible',auth.auth, lotesController.actualizarCantidadDisponible);

module.exports = api;