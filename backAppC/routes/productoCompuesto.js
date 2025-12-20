var express = require('express');
var api = express.Router();
var productoCompuestoController = require('../controllers/productoCompuestoController');
var auth = require('../middlewares/autenticate');

api.post('/compuestos', auth.auth, productoCompuestoController.crear_producto_compuesto);
api.get('/compuestos/:idProductoPadre',auth.auth, productoCompuestoController.obtener_componentes);
api.put('/compuestos/:idProductoPadre',auth.auth, productoCompuestoController.actualizar_componentes);
api.delete('/compuestos/:idProductoPadre',auth.auth, productoCompuestoController.eliminar_producto_compuesto);
api.get('/compuestos/:idProductoPadre/stock/:idSucursal?',auth.auth, productoCompuestoController.calcular_stock_compuesto);

module.exports = api;