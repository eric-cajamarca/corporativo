const express = require('express');
const factilizaController = require('../controllers/factilizaController');
const auth = require('../middlewares/autenticate');
const api = express.Router();

api.post('/consultar-comprobante-sunat', auth.auth, factilizaController.consultarComprobanteSunat);

api.get('/ruc/anexo/:ruc', factilizaController.getAnexo);
api.get('/dni/:dni', factilizaController.getDni);
api.get('/cextranjeria/:cee', factilizaController.getCextranjeria);
api.get('/ruc/:ruc', factilizaController.getRuc);
api.get('/tipocambio/:fecha', factilizaController.getTipoCambio);
api.get('/placa/:placa', factilizaController.getPlaca);
api.get('/soat/:placa', factilizaController.getSoat);
api.get('/licencia/:dni', factilizaController.getLicencia);
api.post('/xml', factilizaController.getXmlSunat);

module.exports = api;