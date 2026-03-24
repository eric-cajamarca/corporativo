const puppeteer = require('puppeteer');

/** Reutilizar Chromium entre peticiones (evita ~1–3 s de launch por PDF). */
let browserSingleton = null;
let browserLaunchPromise = null;

async function getSharedBrowser() {
  if (browserSingleton && browserSingleton.isConnected()) return browserSingleton;
  if (!browserLaunchPromise) {
    browserLaunchPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    }).then((b) => {
      browserSingleton = b;
      b.on('disconnected', () => {
        browserSingleton = null;
        browserLaunchPromise = null;
      });
      return b;
    }).catch((err) => {
      browserLaunchPromise = null;
      throw err;
    });
  }
  return browserLaunchPromise;
}

/**
 * Genera PDF desde HTML.
 * @param {string} html - HTML del contenido
 * @param {number} fontSize - Tamaño de fuente base
 * @param {string} formato - 'A4' | 'A5' | 'ticket' (ticket = 80mm de ancho)
 */
async function generatePdfFromHtml(html, fontSize = 11, formato = 'A4') {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  try {
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

    await page.setContent(wrappedHtml, { waitUntil: 'domcontentloaded', timeout: 20000 });

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
    await page.close();
  }
}

module.exports = { generatePdfFromHtml };