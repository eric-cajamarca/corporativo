const express = require('express');
const api = express.Router();
const cventasController = require('../controllers/cventasController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD para la tabla Comp_Ventas

// CREATE
//api.post('/', cventasController.createCompVenta);

// GET

api.get('/cventas/:id/:aliasempresa', auth.auth, cventasController.getCompVentaById_Empresa);

// api.get('/cventas/:id', auth.auth, cventasController.getCompVentaById);

// UPDATE
api.put('/cventas/:id', cventasController.updateCompVenta);

// DELETE
api.delete('/cventas/:id', cventasController.deleteCompVenta);

module.exports = api;