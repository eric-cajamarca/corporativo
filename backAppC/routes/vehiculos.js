const express = require("express");
const auth = require("../middlewares/autenticate");
const vehiculosController = require("../controllers/vehiculosController");
const router = express.Router();

router.use(auth.auth);

router.post("/vehiculos/guardar", vehiculosController.guardarVehiculoYSoat);
router.get("/vehiculos", vehiculosController.listarVehiculos);
router.get("/vehiculos/soat-vencido", vehiculosController.listarVehiculosSoatVencido);
router.delete("/vehiculos/:idVehiculo", vehiculosController.eliminarVehiculo);

module.exports = router;
