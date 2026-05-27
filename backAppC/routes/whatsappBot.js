const express = require('express');
const router = express.Router();
const whatsappBotController = require('../controllers/whatsappBotController');
const { verificarWebhookSecret } = require('../middlewares/whatsappBotWebhook.middleware');
const { auth } = require('../middlewares/autenticate');

router.post('/inbound', verificarWebhookSecret, whatsappBotController.inbound);

router.use(auth);
router.get('/config', whatsappBotController.getConfig);
router.put('/config', whatsappBotController.updateConfig);
router.post('/catalogo/sync', whatsappBotController.syncCatalogo);
router.get('/catalogo/status', whatsappBotController.catalogoStatus);
router.get('/sinonimos', whatsappBotController.listarSinonimos);
router.post('/sinonimos', whatsappBotController.crearSinonimo);
router.delete('/sinonimos/:idSinonimo', whatsappBotController.eliminarSinonimo);
router.get('/logs', whatsappBotController.listarLogs);
router.get('/escaladas', whatsappBotController.listarEscaladas);
router.post('/escaladas/desescalar', whatsappBotController.desescalarManual);

module.exports = router;
