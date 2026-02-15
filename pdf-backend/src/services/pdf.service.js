const puppeteer = require('puppeteer');

/**
 * Genera PDF desde HTML.
 * @param {string} html - HTML del contenido
 * @param {number} fontSize - Tamaño de fuente base
 * @param {string} formato - 'A4' | 'A5' | 'ticket' (ticket = 80mm de ancho)
 */
async function generatePdfFromHtml(html, fontSize = 11, formato = 'A4') {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(15000);
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-size: ${fontSize}px !important;
            font-family: Arial, sans-serif;
          }
          .detalle-factura { font-size: ${fontSize}px !important; }
        </style>
      </head>
      <body>${html}</body></html>`;

    await page.setContent(wrappedHtml, { waitUntil: 'networkidle0', timeout: 20000 });

    const isTicket = String(formato).toLowerCase() === 'ticket';
    const pdfOptions = {
      printBackground: true,
      margin: isTicket ? { top: '0.3cm', bottom: '0.3cm', left: '0.3cm', right: '0.3cm' } : { top: '0.5cm', bottom: '0.5cm', left: '1cm', right: '1cm' },
      displayHeaderFooter: !isTicket
    };
    if (isTicket) {
      pdfOptions.width = '80mm';
      pdfOptions.height = '297mm';
    } else {
      pdfOptions.format = formato === 'A5' ? 'A5' : 'A4';
    }

    return await page.pdf(pdfOptions);

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePdfFromHtml };