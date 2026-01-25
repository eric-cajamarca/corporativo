// SIEMPRE usa rutas RESTful (regla 1.5)
// SIEMPRE aplica middleware de autenticación ANTES de las rutas
const express = require('express');
const api = express.Router();
const gestoresController = require('../controllers/gestoresController');
const auth = require('../middlewares/autenticate');

// Aplicar middleware de autenticación a todas las rutas
api.use(auth.auth);

// Rutas de gestores de empresas
api.get('/', gestoresController.obtener_empresas_gestionadas);
api.get('/todos', gestoresController.obtener_todos_gestores);
api.get('/buscar/:ruc', gestoresController.buscar_empresa_ruc);
api.post('/', gestoresController.asignar_empresa_gestionada);
api.put('/activar/:idGestor', gestoresController.activar_empresa_gestionada);
api.put('/remover/:idGestor', gestoresController.remover_empresa_gestionada);
api.delete('/:idGestor', gestoresController.eliminar_empresa_gestionada);

// Rutas de configuración de empresa
api.get('/configuracion', gestoresController.obtener_configuracion);
api.post('/configuracion', gestoresController.guardar_configuracion);

module.exports = api;
