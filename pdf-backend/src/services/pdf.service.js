const puppeteer = require('puppeteer');

async function generatePdfFromHtml(html, fontSize = 11) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
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

    await page.setContent(wrappedHtml, { waitUntil: 'networkidle0' });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0.5cm', bottom: '0.5cm', left: '1cm', right: '1cm' },
      displayHeaderFooter: true
    });

  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { generatePdfFromHtml };