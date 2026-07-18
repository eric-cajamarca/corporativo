const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../middlewares/autenticate');
const libroReclamacionesController = require('../controllers/libroReclamacionesController');

const router = express.Router();

const limiterRegistro = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Intente nuevamente en unos minutos.' }
});

const limiterInfo = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false
});

/** Público: info del proveedor + registro de hoja */
router.get('/public/libro-reclamaciones/proveedor', limiterInfo, libroReclamacionesController.infoProveedor);
router.post('/public/libro-reclamaciones', limiterRegistro, libroReclamacionesController.registrar);

/** Admin plataforma (superAdmin empresa principal) */
router.get('/libro-reclamaciones', auth.auth, libroReclamacionesController.listar);
router.get('/libro-reclamaciones/:idReclamacion', auth.auth, libroReclamacionesController.obtener);
router.patch('/libro-reclamaciones/:idReclamacion/respuesta', auth.auth, libroReclamacionesController.responder);

module.exports = router;
