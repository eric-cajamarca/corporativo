const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const productoUnidadVentaController = require('../controllers/productoUnidadVentaController');

api.get('/productos/:idProducto/unidades-venta', auth.auth, productoUnidadVentaController.obtener);
api.put('/productos/:idProducto/unidades-venta', auth.auth, productoUnidadVentaController.guardar);

module.exports = api;
