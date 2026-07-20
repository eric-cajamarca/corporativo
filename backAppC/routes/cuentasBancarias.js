const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const cuentasBancariasController = require('../controllers/cuentasBancariasController');

api.use(auth.auth);

api.get('/cuentas-bancarias', cuentasBancariasController.listar);
api.post('/cuentas-bancarias', cuentasBancariasController.crear);
api.put('/cuentas-bancarias/:id', cuentasBancariasController.actualizar);
api.delete('/cuentas-bancarias/:id', cuentasBancariasController.eliminar);

module.exports = api;
