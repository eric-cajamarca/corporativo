const express = require('express');
const api = express.Router();
const rolController = require('../controllers/rolController');
var auth  = require('../middlewares/autenticate');

// Rutas CRUD para la tabla Rol

api.post('/rol', auth.auth, rolController.crear_rol);
api.get('/rol', auth.auth, rolController.obtener_roles);
api.get('/rol/:id', auth.auth, rolController.obtener_rol_id);
api.put('/rol/:id', auth.auth, rolController.actualizar_rol);

module.exports = api;