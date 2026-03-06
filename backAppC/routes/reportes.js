const express = require('express');
const router = express.Router();
const reportesController = require('../controllers/reportes.controller');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

router.use(auth);
router.use(querySafeMiddleware);

// Compras por proveedor en un rango de fechas
router.get('/compras-proveedor', reportesController.getComprasPorProveedor);

// Resumen simple de inventario (stock y valor por producto)
router.get('/inventario-resumen', reportesController.getInventarioResumen);

// Clientes más importantes por compras y deuda
router.get('/clientes-rentabilidad', reportesController.getClientesRentabilidad);

// Resumen de cartera de créditos (usar lógica existente de créditos)
router.get('/cartera-creditos', reportesController.getCarteraCreditos);

module.exports = router;

