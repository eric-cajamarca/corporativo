var express = require('express');
var api = express.Router();
var tablasSunatController = require('../controllers/tablassunatController');
var auth  = require('../middlewares/autenticate');

// Rutas para el CRUD de tablas sunat
api.get('/estadopago',auth.auth, tablasSunatController.obtener_estado_pago);
api.get('/mediospago',auth.auth, tablasSunatController.obtener_medios_pago);
api.get('/estadosunat',auth.auth, tablasSunatController.obtener_estado_sunat);
api.get('/moneda',auth.auth, tablasSunatController.obtener_moneda);
api.get('/leyenda',auth.auth, tablasSunatController.obtener_leyenda);
api.get('/tipodoc',auth.auth, tablasSunatController.obtener_tipo_doc);
api.get('/tipooperacion',auth.auth, tablasSunatController.obtener_tipo_operacion);
api.get('/modalidadtraslado',auth.auth, tablasSunatController.obtener_modalidad_traslado);
api.get('/motivostraslado',auth.auth, tablasSunatController.obtener_motivos_traslado);
api.get('/tipofactura',auth.auth, tablasSunatController.obtener_tipo_factura);
api.get('/regimenpercepcion',auth.auth, tablasSunatController.obtener_regimen_percepcion);
api.get('/regimenretencion',auth.auth, tablasSunatController.obtener_regimen_retencion);
api.get('/tributos',auth.auth, tablasSunatController.obtener_tributos);


module.exports = api;
