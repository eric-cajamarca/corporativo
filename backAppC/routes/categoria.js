var express = require('express');
var api = express.Router();
var categoriaController = require('../controllers/categoriaController');
var auth  = require('../middlewares/autenticate');


    // obtener_Categorias,
    // obtener_Categorias_idEmpresa,
    // obtener_Categoria_id,
    // obtener_Categoria_id_idempresa,
    // crear_Categoria,
    // editar_Categoria,
    // eliminar_Categoria  
// Rutas para el CRUD de categoria
api.get('/categorias',auth.auth, categoriaController.obtener_Categorias);
//api.get('/categoriasempresa',auth.auth, categoriaController.obtener_Categorias_idEmpresa);
api.get('/categorias/:id',auth.auth, categoriaController.obtener_Categoria_id);
//api.get('/categoriasempresa/:id',auth.auth, categoriaController.obtener_Categoria_id_idempresa);
api.post('/categorias', auth.auth, categoriaController.crear_Categoria);
api.put('/categorias/:id',auth.auth, categoriaController.editar_Categoria);
api.delete('/categorias/:id',auth.auth, categoriaController.eliminar_Categoria);

//cambiar_estado_categoria
api.put('/cambiar_estado/:id',auth.auth, categoriaController.cambiar_estado_categoria);


module.exports = api;