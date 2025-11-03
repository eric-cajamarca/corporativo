const express = require('express');
const api = express.Router();
const programacionController = require('../controllers/programacionController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD para la tabla
// READ
api.get('/programacion', auth.auth, programacionController.obtener_programacion);
api.get('/programacion/:id', auth.auth, programacionController.obtener_programacion_id);

// CREATE
// api.post('/empresa',auth.auth, empresasController.createEmpresa);



// UPDATE
// api.put('/empresa/:id', empresasController.updateEmpresa);

// DELETE
// api.delete('/empresa/:id', empresasController.deleteCompVenta);

module.exports = api;