const express = require('express');
const { generatePdf } = require('../controllers/pdf.controller');
const { generateExcel } = require('../controllers/excel.controller');

const router = express.Router();

router.post('/generate-pdf', generatePdf);
router.post('/generate-excel', generateExcel);

module.exports = router;