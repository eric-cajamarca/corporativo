const express = require('express');
const api = express.Router();
const productoVarianteController = require('../controllers/productoVarianteController');
const authMiddleware = require('../middlewares/authMiddleware');

api.use(authMiddleware);

// Rutas para atributos
api.post('/atributos', productoVarianteController.crear_atributo);
api.post('/atributos/:idAtributo/valores', productoVarianteController.agregar_valor_atributo);
api.get('/atributos', productoVarianteController.obtener_atributos_empresa);

// Rutas para variantes
api.post('/variantes', productoVarianteController.crear_variante);
api.get('/productos/:idProductoBase/variantes', productoVarianteController.obtener_variantes_producto);
api.get('/variantes/:idVariante', productoVarianteController.obtener_variante_por_id);
api.put('/variantes/:idVariante', productoVarianteController.actualizar_variante);
api.delete('/variantes/:idVariante', productoVarianteController.eliminar_variante);

module.exports = api;