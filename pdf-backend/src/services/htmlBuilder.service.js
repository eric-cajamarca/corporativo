class HtmlBuilderService {
  /**
   * Construye HTML completo para reportes con header de empresa
   * @param {Object} params - Parámetros de construcción
   * @param {string} params.titulo - Título del reporte
   * @param {Object} params.empresa - Datos de la empresa {nombre, ruc, direccion, telefono, logo}
   * @param {string} params.tablaHtml - HTML de la tabla con datos
   * @param {string} params.estiloAdicional - CSS extra opcional
   * @param {string} params.contenidoAdicional - HTML extra opcional (resumen, observaciones, etc.)
   * @returns {string} HTML completo listo para PDF
   */
  construirHtmlReporte(params) {
    const {
      titulo = 'Reporte',
      empresa,
      tablaHtml,
      estiloAdicional = '',
      contenidoAdicional = ''
    } = params;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titulo}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 10px;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    
    .header {
      border-bottom: 5px solid #0056b3;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    
    .logo {
      max-width: 100px;
      height: auto;
    }
    
    .datos-empresa h3 {
      margin: 0 0 5px 0;
      color: #0056b3;
      font-size: 14px;
    }
    
    .datos-empresa p {
      margin: 0;
      line-height: 1.4;
      font-size: 9px;
    }
    
    h2 {
      color: #0056b3;
      margin: 20px 0 10px 0;
      font-size: 14px;
    }
    
    .fecha-reporte {
      color: #666;
      margin-bottom: 15px;
      font-size: 9px;
      font-style: italic;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      font-size: 9px;
    }
    
    th, td {
      border: 1px solid #ccc;
      padding: 6px;
      text-align: left;
      vertical-align: top;
    }
    
    th {
      background-color: #f2f2f2;
      font-weight: bold;
      text-align: center;
    }
    
    .text-end {
      text-align: right;
    }
    
    .text-center {
      text-align: center;
    }
    
    .totales-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    .totales-table td {
      padding: 4px;
      border: none;
    }
    
    .totales-table td:nth-child(2) {
      text-align: right;
      font-weight: bold;
    }
    
    .resumen-digital, .observaciones {
      margin-top: 20px;
      padding: 10px;
      background-color: #f9f9f9;
      border-left: 4px solid #0056b3;
      font-size: 9px;
    }
    
    ${estiloAdicional}
  </style>
</head>
<body>
  <div class="header">
    <table style="width: 100%; border: none; border-collapse: collapse;">
      <tr>
        <td style="border: none; width: 30%; vertical-align: top;">
          ${empresa?.logo ? `<img src="${empresa.logo}" alt="Logo" class="logo">` : ''}
        </td>
        <td style="border: none; width: 70%; padding-left: 15px;">
          <div class="datos-empresa">
            <h3>${empresa?.nombre || ''}</h3>
            <p>
              ${empresa?.ruc ? `RUC: ${empresa.ruc}<br>` : ''}
              ${empresa?.direccion ? `${empresa.direccion}<br>` : ''}
              ${empresa?.telefono ? `Tel: ${empresa.telefono}` : ''}
            </p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <h2>${titulo}</h2>
  <div class="fecha-reporte">Fecha de reporte: ${new Date().toLocaleDateString('es-PE')}</div>

  ${tablaHtml}

  ${contenidoAdicional}
</body>
</html>`;
  }

  /**
   * Construye tabla HTML desde arrays de datos
   * @param {string[]} headers - Nombres de columnas
   * @param {Array<Array>} filas - Array de arrays con datos
   * @param {Object} options - Opciones de formato
   * @returns {string} HTML de la tabla
   */
  construirTablaHtml(headers, filas, options = {}) {
    const {
      clasesTabla = 'tabla-datos',
      clasesTh = '',
      clasesTd = ''
    } = options;

    const headersHtml = headers.map(h => `<th class="${clasesTh}">${h}</th>`).join('');
    
    const filasHtml = filas.map(fila => {
      const celdas = fila.map(celda => {
        const valor = celda !== undefined && celda !== null ? celda : '';
        return `<td class="${clasesTd}">${valor}</td>`;
      }).join('');
      return `<tr>${celdas}</tr>`;
    }).join('');

    return `<table class="${clasesTabla}">
      <thead><tr>${headersHtml}</tr></thead>
      <tbody>${filasHtml}</tbody>
    </table>`;
  }
}

module.exports = new HtmlBuilderService();