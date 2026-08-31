const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const { requireRubro } = require('../middlewares/rubroFeature.middleware');
const formulaMatizadoController = require('../controllers/formulaMatizadoController');

api.use('/matizado', auth.auth, requireRubro('PINT'));
api.get('/matizado/formulas', formulaMatizadoController.listar);
api.get('/matizado/formulas/:idFormula', formulaMatizadoController.obtener);
api.post('/matizado/formulas', formulaMatizadoController.guardar);
api.put('/matizado/formulas/:idFormula', formulaMatizadoController.guardar);
api.delete('/matizado/formulas/:idFormula', formulaMatizadoController.eliminar);

module.exports = api;
