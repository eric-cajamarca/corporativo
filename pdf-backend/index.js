const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const app = express();
app.use(express.json({ limit: '10mb' })); // para recibir HTML grande

// Permitir solo el origen de tu frontend (más seguro)
app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// backend endpoint (ej. /generate-pdf)
app.post('/generate-pdf', async (req, res) => {
  const { html, fontSize = 11} = req.body;   // ← tamaño opcional (px)

  if (!html) {
    return res.status(400).json({ error: 'HTML es requerido' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    /* --- injectamos el tamaño de letra deseado --- */
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{
            font-size: ${fontSize}px !important;   /* valor recibido */
            font-family: Arial, sans-serif;
          }
          /* si quieres que solo cambie el detalle, usa una clase */
          .detalle-factura { font-size: ${fontSize}px !important; }
        </style>
      </head>
      <body>${html}</body></html>`;

    await page.setContent(wrappedHtml, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5cm', bottom: '0.5cm', left: '1cm', right: '1cm' },
      displayHeaderFooter: true,
      // headerTemplate: `
      //   <div style="font-size:10px; text-align:center; width:100%;">
      //     <span class="pageNumber"></span> / <span class="totalPages"></span>
      //   </div>`,
      // footerTemplate: `
      //   <div style="font-size:8px; text-align:center; width:100%;">
      //     Empresa Mi Empresa S.A.C. - RUC: 20123456789
      //   </div>`
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="documento.pdf"');
    res.send(pdf);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al generar el PDF' });
  } finally {
    if (browser) await browser.close();
  }
});
// Ruta de prueba
app.get('/', (req, res) => {
  res.send('PDF Backend con Puppeteer está funcionando ✅');
});

// Iniciar servidor
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});