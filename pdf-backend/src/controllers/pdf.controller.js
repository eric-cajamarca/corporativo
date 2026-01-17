const { generatePdfFromHtml } = require('../services/pdf.service');
const htmlBuilder = require('../services/htmlBuilder.service');

async function generatePdf(req, res) {
  const { datos, tipo, fontSize} = req.body;

  console.log('Received fontSize en pdf:', req.body);  
  if (!datos) {
    return res.status(400).json({ error: 'Datos son requeridos' });
  }

  try {
    let html;
    
    // Soporte para múltiples tipos de reportes
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
        
      default:
        // Si no es un tipo conocido, usa HTML directo (compatibilidad hacia atrás)
        html = datos.html;
    }

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
