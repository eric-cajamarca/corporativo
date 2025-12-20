var express = require('express');
var api = express.Router();
var productoVarianteController = require('../controllers/productoVarianteController');
var auth = require('../middlewares/autenticate');



// Rutas para atributos
api.post('/atributos',auth.auth, productoVarianteController.crear_atributo);
api.post('/atributos/:idAtributo/valores',auth.auth, productoVarianteController.agregar_valor_atributo);
api.get('/atributos',auth.auth, productoVarianteController.obtener_atributos_empresa);

// Rutas para variantes
api.post('/variantes',auth.auth, productoVarianteController.crear_variante);
api.get('/productos/:idProductoBase/variantes',auth.auth, productoVarianteController.obtener_variantes_producto);
api.get('/variantes/:idVariante',auth.auth, productoVarianteController.obtener_variante_por_id);
api.put('/variantes/:idVariante',auth.auth, productoVarianteController.actualizar_variante);
api.delete('/variantes/:idVariante',auth.auth, productoVarianteController.eliminar_variante);

module.exports = api;