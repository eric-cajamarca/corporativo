const express = require('express');
const router = express.Router();
const creditosController = require('../controllers/creditosController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Rutas para gestión de créditos
router.get('/todos', creditosController.obtenerCreditosClienteTodos);  // GET /api/creditos/todos = listar todos
router.get('/cliente', creditosController.obtenerCreditosClienteTodos);
router.get('/cliente/:idCliente', creditosController.obtenerCreditosCliente);
router.post('/', creditosController.crearCredito);
router.post('/cobranza-masiva', creditosController.pagarCuotasMasivo);

// Rutas para cuotas
router.get('/:idCredito/cuotas', creditosController.obtenerCuotasCredito);
router.post('/cuotas/:idCuota/pagar', creditosController.pagarCuota);

// Rutas para reportes y análisis
router.get('/resumen', creditosController.obtenerResumenCreditos);
router.get('/cuotas/pendientes', creditosController.obtenerCuotasPendientes);
router.get('/eficiencia-cobros', creditosController.obtenerEficienciaCobros);

module.exports = router;