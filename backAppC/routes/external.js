const express = require('express');
const router = express.Router();
const auth = require('../middlewares/autenticate');
const externalController = require('../controllers/externalController');

router.get('/dni/:dni', auth.auth, externalController.getDni);
router.get('/ruc/anexo/:ruc', auth.auth, externalController.getRucAnexo);
router.get('/ruc/:ruc', auth.auth, externalController.getRuc);
router.get('/cee/:cee', auth.auth, externalController.getCee);

module.exports = router;
