const express = require('express');
const multer = require('multer');
const { generatePdf } = require('../controllers/pdf.controller');
const { generateExcel } = require('../controllers/excel.controller');
const { parseExcel, MAX_BYTES } = require('../controllers/excelParse.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES }
});

const router = express.Router();

router.post('/generate-pdf', generatePdf);
router.post('/generate-excel', generateExcel);
router.post('/parse-excel', upload.single('file'), parseExcel);

module.exports = router;