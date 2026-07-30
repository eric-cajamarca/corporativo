const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const { auth } = require("../middlewares/autenticate");
const { querySafeMiddleware } = require("../middlewares/tenant-query");

router.use(auth);
router.use(querySafeMiddleware);

router.get("/resumen", dashboardController.obtenerResumenDashboard);
router.get("/resumen-diario", dashboardController.obtenerResumenDiario);
router.get("/resumen-consolidado", dashboardController.obtenerResumenConsolidadoGestora);

module.exports = router;
