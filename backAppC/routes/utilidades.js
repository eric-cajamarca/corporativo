const express = require('express');
const router = express.Router();
const utilidadesController = require('../controllers/utilidades.controller');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

router.use(auth);
router.use(querySafeMiddleware);

router.get('/', utilidadesController.getUtilidades);
router.get('/detalle', utilidadesController.getUtilidadesDetalle);

module.exports = router;
