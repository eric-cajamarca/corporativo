const express = require('express');
const api = express.Router();
const rEnviosController = require('../controllers/renviosController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD
api.get('/envios', rEnviosController.obtenerEnvios);
// CREATE
api.post('/envios', auth.auth, rEnviosController.createCompEnvio);

// READ
api.get('/envios/:id', auth.auth, rEnviosController.getCompEnvio);
    

// // UPDATE
api.put('/envios/:id', rEnviosController.updateCompEnvio);

// // DELETE
 api.delete('/envios/:id', rEnviosController.deleteCompEnvio);

module.exports = api;