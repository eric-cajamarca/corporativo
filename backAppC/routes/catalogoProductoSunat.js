const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const catalogoProductoSunatController = require('../controllers/catalogoProductoSunatController');

api.get('/catalogo-producto-sunat', auth.auth, catalogoProductoSunatController.listar);
api.get('/catalogo-producto-sunat/sugerir', auth.auth, catalogoProductoSunatController.sugerir);
api.post('/catalogo-producto-sunat/sugerir', auth.auth, catalogoProductoSunatController.sugerir);

module.exports = api;
