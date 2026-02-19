const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const auditoriaController = require('../controllers/auditoriaController');

router.get('/', auth.auth, auditoriaController.listar);

module.exports = router;
