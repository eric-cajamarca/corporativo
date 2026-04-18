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
 * Si el cliente envía un documento HTML completo (Angular GRE/facturas), extraer <head> y contenido de <body>.
 * Insertar un <html> dentro de <body> rompe el árbol DOM en Chromium y suele hacer desaparecer el pie (QR, firmas).
 * @param {string} rawHtml
 * @returns {{ headInject: string, bodyHtml: string }}
 */
function extractHtmlDocumentParts(rawHtml) {
  const s = String(rawHtml || '').trim();
  const looksLikeFullDoc = /<!DOCTYPE/i.test(s) || /<\s*html[\s>]/i.test(s);
  if (!looksLikeFullDoc) {
    return { headInject: '', bodyHtml: s };
  }
  const headM = s.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const bodyM = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const headInject = headM ? headM[1] : '';
  const bodyHtml = bodyM ? bodyM[1].trim() : s;
  return { headInject, bodyHtml };
}

/**
 * Genera PDF desde HTML.
 * @param {string} html - HTML del contenido
 * @param {number} fontSize - Tamaño de fuente base
 * @param {string} formato - 'A4' | 'A5' | 'ticket' (ticket = 80mm ancho; QR comprobante ~2cm en HTML)
 */
async function generatePdfFromHtml(html, fontSize = 11, formato = 'A4') {
  const browser = await getSharedBrowser();
  const page = await browser.newPage();
  try {
    await page.setDefaultNavigationTimeout(15000);
    const { headInject, bodyHtml } = extractHtmlDocumentParts(html);
    const wrappedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${headInject}
        <style>
          body {
            font-size: ${fontSize}px !important;
            font-family: Arial, sans-serif;
          }
          .detalle-factura { font-size: ${fontSize}px !important; }
        </style>
      </head>
      <body>${bodyHtml}</body></html>`;

    await page.setContent(wrappedHtml, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const isTicket = String(formato).toLowerCase() === 'ticket';
    const pdfOptions = {
      printBackground: true,
      margin: isTicket ? { top: '0.3cm', bottom: '0.3cm', left: '0.3cm', right: '0.3cm' } : { top: '0.5cm', bottom: '0.8cm', left: '1cm', right: '1cm' },
      // Sin plantillas de encabezado/pie: true solo reduce área útil y puede recortar imágenes al final (p.ej. QR GRE).
      displayHeaderFooter: false
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