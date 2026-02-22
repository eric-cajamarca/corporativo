const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const inventarioController = require('../controllers/inventarioController');

router.use(auth.auth);

router.post('/movimientos', inventarioController.registrarMovimiento);
router.get('/movimientos', inventarioController.listarMovimientos);
router.get('/tipos-movimiento', inventarioController.tiposMovimiento);
router.get('/kardex', inventarioController.kardex);

module.exports = router;
