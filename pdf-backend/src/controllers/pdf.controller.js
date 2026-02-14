const { generatePdfFromHtml } = require('../services/pdf.service');
const htmlBuilder = require('../services/htmlBuilder.service');

async function generatePdf(req, res) {
  const { datos, tipo, fontSize, formato } = req.body;

  if (!datos) {
    return res.status(400).json({ error: 'Datos son requeridos' });
  }

  const formatoPdf = formato === 'ticket' || formato === 'A5' ? formato : 'A4';
  const fontSizeNum = typeof fontSize === 'number' ? fontSize : 10;

  try {
    let html;

    switch (tipo) {
      case 'lista-compras':
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Lista de Compras',
          empresa: datos.empresa,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas, datos.filas)
        });
        break;

      case 'factura':
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Factura Electrónica',
          empresa: datos.empresa,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas, datos.filas),
          contenidoAdicional: `
            <div class="resumen-digital">
              <strong>SON:</strong> ${datos.cantidadLetras || ''}
            </div>
            <div class="observaciones">
              <strong>Resumen Digital:</strong><br>${datos.resumenDigital || ''}
            </div>
          `
        });
        break;

      case 'lista-ventas':
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Lista de Ventas',
          empresa: datos.empresa,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas, datos.filas)
        });
        break;

      case 'comprobante-venta':
        html = htmlBuilder.construirHtmlComprobanteVenta({
          empresa: datos.empresa,
          venta: datos.venta,
          cliente: datos.cliente,
          items: datos.items || [],
          cantidadLetras: datos.cantidadLetras || ''
        });
        break;

      default:
        html = datos.html;
    }

    const pdfBuffer = await generatePdfFromHtml(html, fontSizeNum, formatoPdf);

    const nombreArchivo = datos.nombreArchivo || 'documento.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error al generar el PDF:', error);
    res.status(500).json({ error: 'Error al generar el PDF' });
  }
}

module.exports = { generatePdf };
