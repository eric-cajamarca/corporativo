const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

const choferesController = require('../controllers/choferesController');

router.use(auth.auth);
router.use(querySafeMiddleware);

// Catálogo / gestión choferes internos
router.get('/', choferesController.listarChoferes);
router.get('/usuarios', choferesController.listarUsuariosChoferRol);
router.post('/', choferesController.crearOActualizarChofer);

module.exports = router;

