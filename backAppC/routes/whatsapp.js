const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { auth } = require('../middlewares/autenticate');

router.use(auth);

router.post('/send-text', whatsappController.sendText);
router.post('/send-media', whatsappController.sendMedia);

module.exports = router;
