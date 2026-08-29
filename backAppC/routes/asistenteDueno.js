const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/autenticate');
const asistenteDuenoController = require('../controllers/asistenteDuenoController');

router.use(auth);
router.get('/estado', asistenteDuenoController.estado);
router.post('/chat', asistenteDuenoController.chat);

module.exports = router;
