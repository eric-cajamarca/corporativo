const express = require('express');
const api = express.Router();
const auth = require('../middlewares/autenticate');
const cuentasBancariasController = require('../controllers/cuentasBancariasController');

api.get('/cuentas-bancarias', auth.auth, cuentasBancariasController.listar);
api.post('/cuentas-bancarias', auth.auth, cuentasBancariasController.crear);
api.put('/cuentas-bancarias/:id', auth.auth, cuentasBancariasController.actualizar);
api.delete('/cuentas-bancarias/:id', auth.auth, cuentasBancariasController.eliminar);

module.exports = api;
