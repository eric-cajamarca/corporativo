const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const hotelController = require('../controllers/hotelController');

api.use(auth.auth);
api.use(requireRubro('HOTEL'));

api.post('/hotel/cerrar-post-venta', hotelController.cerrarPostVenta);

module.exports = api;
