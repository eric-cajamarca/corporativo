const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');
const busquedaGlobalController = require('../controllers/busquedaGlobalController');

router.use(auth);
router.use(querySafeMiddleware);

router.get('/', busquedaGlobalController.buscar);

module.exports = router;
