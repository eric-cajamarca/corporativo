const { generatePdfFromHtml } = require('../services/pdf.service');

async function generatePdf(req, res) {
  const { html, fontSize = 11 } = req.body;

  console.log('Received fontSize:', fontSize);

  if (!html) {
    return res.status(400).json({ error: 'HTML es requerido' });
  }

  try {
    const pdfBuffer = await generatePdfFromHtml(html, fontSize);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.send(pdfBuffer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
}

module.exports = { generatePdf };