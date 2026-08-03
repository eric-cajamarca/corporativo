const express = require('express');
const router = express.Router();
const analisisController = require('../controllers/analisisController');
const { auth } = require('../middlewares/autenticate');
const { querySafeMiddleware } = require('../middlewares/tenant-query');

// Aplicar middleware de autenticación y tenant-query a todas las rutas
router.use(auth);
router.use(querySafeMiddleware);

// Dashboard ejecutivo
router.get('/dashboard', analisisController.obtenerDashboardEjecutivo);

// Estados financieros
router.get('/balance-general', analisisController.obtenerBalanceGeneral);
router.get('/estado-resultados', analisisController.obtenerEstadoResultados);
router.get('/flujo-caja', analisisController.obtenerFlujoCaja);
router.get('/flujo-caja/serie', analisisController.obtenerFlujoCajaSerie);

// Ratios financieros
router.get('/ratios', analisisController.obtenerRatiosFinancieros);

// Análisis de rentabilidad
router.get('/rentabilidad', analisisController.obtenerAnalisisRentabilidad);

// Eficiencia operativa
router.get('/eficiencia-operativa', analisisController.obtenerEficienciaOperativa);

// Proyecciones y análisis predictivo
router.get('/proyeccion-ventas', analisisController.obtenerProyeccionVentas);
router.get('/punto-equilibrio', analisisController.obtenerPuntoEquilibrio);

// Diagnóstico completo
router.get('/diagnostico-financiero', analisisController.obtenerDiagnosticoFinanciero);

// Gastos operativos / costos fijos (puntuales y recurrentes)
router.get('/gastos', analisisController.listarGastos);
router.post('/gastos', analisisController.crearGasto);
router.put('/gastos/:idGasto', analisisController.actualizarGasto);
router.delete('/gastos/:idGasto', analisisController.eliminarGasto);

module.exports = router;