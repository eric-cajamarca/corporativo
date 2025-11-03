var express = require('express');
var api = express.Router();
var unidporcajaController = require('../controllers/unidporcajaController');
var auth  = require('../middlewares/autenticate');

// obtenerUnidPorCaja,
//     editarUnidPorCaja

// Rutas para el CRUD de unidporcaja
api.get('/unidporcaja',auth.auth, unidporcajaController.obtenerUnidPorCaja);
api.put('/unidporcaja/:id',auth.auth, unidporcajaController.editarUnidPorCaja);

module.exports = api;