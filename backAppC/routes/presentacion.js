var express = require('express');
var api = express.Router();
var presentacionController = require('../controllers/presentacionController');
var auth  = require('../middlewares/autenticate');

// obtener_Presentaciones,
//     obtener_presentacion_id,
//     crear_Presentacion,
//     editar_presentacion,
//     eliminar_presentacion

api.get('/presentaciones',auth.auth, presentacionController.obtener_Presentaciones);
api.get('/presentaciones/:id',auth.auth, presentacionController.obtener_presentacion_id);
api.post('/presentaciones', auth.auth, presentacionController.crear_Presentacion);
api.put('/presentaciones/:id',auth.auth, presentacionController.editar_presentacion);
api.delete('/presentaciones/:id',auth.auth, presentacionController.eliminar_presentacion);

module.exports = api;