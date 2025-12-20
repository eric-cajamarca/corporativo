var express = require('express');
var api = express.Router();
var transferenciaController = require('../controllers/transferenciaController');
var auth  = require('../middlewares/autenticate');



// Rutas principales
api.post('/transferencias',auth.auth, transferenciaController.crear_transferencia);
api.get('/transferencias',auth.auth, transferenciaController.obtener_transferencias);
api.get('/transferencias/:idMovimiento',auth.auth, transferenciaController.obtener_transferencia_por_id);
api.post('/transferencias/:idMovimiento/revertir',auth.auth, transferenciaController.revertir_transferencia);
api.post('/transferencias/verificar-stock',auth.auth, transferenciaController.verificar_stock_transferencia);

module.exports = api;