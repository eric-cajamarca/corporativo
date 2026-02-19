const express = require('express');
const factilizaController = require('../controllers/factilizaController');
const auth = require('../middlewares/autenticate');
const api = express.Router();

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