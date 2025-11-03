var express = require('express');
var api = express.Router();
var marcaController = require('../controllers/marcaController');
var auth  = require('../middlewares/autenticate');

    // obtenerMarcas,
    //obtenerMarcaPorId,
    //     crearMarca,
    //     editarMarca,
    //     editarEstadoMarca

// Rutas para el CRUD de marca
api.get('/marcas',auth.auth, marcaController.obtenerMarcas);
api.get('/marcas/:id',auth.auth, marcaController.obtenerMarcaPorId);
api.post('/marcas', auth.auth, marcaController.crearMarca);
api.put('/marcas/:id',auth.auth, marcaController.editarMarca);
api.put('/marcasestado/:id',auth.auth, marcaController.editarEstadoMarca);

module.exports = api;