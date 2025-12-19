const express = require('express');
const api = express.Router();
const productoCompuestoController = require('../controllers/productoCompuestoController');
const authMiddleware = require('../middlewares/authMiddleware');

api.use(authMiddleware);

api.post('/compuestos', productoCompuestoController.crear_producto_compuesto);
api.get('/compuestos/:idProductoPadre', productoCompuestoController.obtener_componentes);
api.put('/compuestos/:idProductoPadre', productoCompuestoController.actualizar_componentes);
api.delete('/compuestos/:idProductoPadre', productoCompuestoController.eliminar_producto_compuesto);
api.get('/compuestos/:idProductoPadre/stock/:idSucursal?', productoCompuestoController.calcular_stock_compuesto);

module.exports = api;