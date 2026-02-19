const express = require('express');
const factilizaController = require('../controllers/factilizaController');
const empresaFactilizaController = require('../controllers/empresaFactilizaController');
const tipoCambioController = require('../controllers/tipoCambioController');
const auth = require('../middlewares/autenticate');
const api = express.Router();

api.get('/factiliza/servicios', auth.auth, empresaFactilizaController.getServicios);
api.get('/factiliza/tipo-cambio', auth.auth, tipoCambioController.getTipoCambioDia);
api.get('/factiliza/tipo-cambio/mes', auth.auth, tipoCambioController.getTipoCambioMes);
api.get('/factiliza/empresas-servicios', auth.auth, empresaFactilizaController.getEmpresasServicios);
api.post('/factiliza/empresas-servicios', auth.auth, empresaFactilizaController.guardarEmpresasServicios);

api.post('/consultar-comprobante-sunat', auth.auth, factilizaController.consultarComprobanteSunat);

api.get('/ruc/anexo/:ruc', auth.auth, factilizaController.getAnexo);
api.get('/dni/:dni', auth.auth, factilizaController.getDni);
api.get('/cextranjeria/:cee', auth.auth, factilizaController.getCextranjeria);
api.get('/ruc/:ruc', auth.auth, factilizaController.getRuc);
api.get('/tipocambio/:fecha', auth.auth, factilizaController.getTipoCambio);
api.get('/placa/:placa', auth.auth, factilizaController.getPlaca);
api.get('/soat/:placa', auth.auth, factilizaController.getSoat);
api.get('/licencia/:dni', auth.auth, factilizaController.getLicencia);
api.post('/xml', auth.auth, factilizaController.getXmlSunat);

module.exports = api;