var express = require('express');
var api = express.Router();
var comprasController = require('../controllers/comprasController');
var comprobantesCompraSunatController = require('../controllers/comprobantesCompraSunatController');
var auth  = require('../middlewares/autenticate');

// Listado de compras de la empresa logueada (ruta única para evitar que otra ruta capture la petición)
api.get('/compras-por-empresa', auth.auth, comprasController.obtener_compras_todos_idEmpresa);

/** Reporte detallado de compras por comprobante (cabecera + líneas). */
api.get('/compras/reporte-detallado', auth.auth, comprasController.getReporteDetallado);

/** CPE de compra (SUNAT) registrados por empresa; filtros vía query string. */
api.get('/comprobantes-compra-sunat', auth.auth, comprobantesCompraSunatController.listar);

// Rutas para el CRUD de compras (rutas más específicas primero)
//api.get('/comprasempresa', auth.auth, comprasController.obtener_compras_todos_idEmpresa);
api.get('/comprasempresa/:id', auth.auth, comprasController.obtener_compras_idCompra_idEmpresa);

api.get('/compras', auth.auth, comprasController.obtener_compras_todos);
api.get('/compras/:id', auth.auth, comprasController.obtener_compras_id);

api.post('/compras', auth.auth, comprasController.crear_compra);
api.put('/compras/:id',auth.auth, comprasController.editar_compra);
api.delete('/compras/:id',auth.auth, comprasController.eliminar_idcompra_empresa);



////////////////////////////////////////////////////////////////////////////////////////////////////////
api.get('/borradorcompras',auth.auth, comprasController.obtener_borrador_compras_empresa);
api.post('/borradorcompras', auth.auth, comprasController.crear_borrador_compras_empresa);
api.put('/borradorcompras/:id',auth.auth, comprasController.editar_borrador_compras_empresa);
api.delete('/borradorcompras/:id',auth.auth, comprasController.eliminar_borrador_compras_empresa);

////////////////////////////////////////////////////////////////////////////////////////////////////////
 //correlativos

api.get('/correlativos',auth.auth, comprasController.obtener_correlativos_empresa);
api.put('/correlativos/:id',auth.auth, comprasController.editar_correlativos_empresa);

////////////////////////////////////////////////////////////////////////////////////////////////////////
//comprobnates
api.get('/comprasCliente/:id',auth.auth, comprasController.buscar_comprobante_idCliente);

module.exports = api;
