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
      contenidoAntesTabla = '',
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
    
    .bloque-datos {
      margin-bottom: 18px;
      padding: 10px;
      background-color: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .bloque-titulo {
      margin: 0 0 8px 0;
      color: #0056b3;
      font-size: 12px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 4px;
    }
    .tabla-datos-inline {
      width: 100%;
      border: none;
      margin: 0;
      font-size: 9px;
    }
    .tabla-datos-inline td {
      border: none;
      padding: 2px 8px 2px 0;
      vertical-align: top;
    }
    .tabla-datos-inline td:first-child {
      width: 140px;
      color: #555;
    }
    .bloque-totales {
      margin-top: 15px;
      margin-bottom: 15px;
    }
    .titulo-tabla {
      margin-top: 20px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #0056b3;
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
              ${empresa?.direccion ? `Dirección: ${empresa.direccion}<br>` : ''}
              ${empresa?.rubro ? `Rubro: ${empresa.rubro}<br>` : ''}
              ${empresa?.ruc ? `RUC: ${empresa.ruc}<br>` : ''}
              ${empresa?.telefono ? `Cel: ${empresa.telefono}<br>` : ''}
              ${empresa?.correo ? `Correo: ${empresa.correo}` : ''}
            </p>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <h2>${titulo}</h2>
  <div class="fecha-reporte">Fecha de reporte: ${new Date().toLocaleDateString('es-PE')}</div>

  ${contenidoAntesTabla}

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

    const headersSafe = Array.isArray(headers) ? headers : [];
    const filasSafe = Array.isArray(filas) ? filas : [];
    const headersHtml = headersSafe.map(h => `<th class="${clasesTh}">${h}</th>`).join('');

    const filasHtml = filasSafe.map(fila => {
      const row = Array.isArray(fila) ? fila : [];
      const celdas = row.map(celda => {
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

  /**
   * Imagen por defecto cuando la empresa no tiene logo (SVG inline para no depender de red).
   */
  _defaultLogoDataUri() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="70" viewBox="0 0 100 70"><rect width="100" height="70" fill="#f5f5f5" stroke="#ddd" stroke-width="1"/><text x="50" y="38" dominant-baseline="middle" text-anchor="middle" fill="#999" font-size="11" font-family="Arial">Logo</text></svg>';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  /**
   * Resuelve logo: si es URL http(s) la descarga y convierte a data URI para que Puppeteer no dependa de red.
   * @param {string} logo - URL del logo o ya data URI
   * @returns {Promise<string>} data URI del logo o default
   */
  async _resolveLogoToDataUri(logo) {
    if (!logo || typeof logo !== 'string') return this._defaultLogoDataUri();
    const s = logo.trim();
    if (s.startsWith('data:')) return s;
    if (!s.startsWith('http://') && !s.startsWith('https://')) return this._defaultLogoDataUri();
    try {
      const res = await fetch(s, { headers: { Accept: 'image/*' } });
      if (!res.ok) return this._defaultLogoDataUri();
      const buf = await res.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      const contentType = res.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${b64}`;
    } catch (e) {
      return this._defaultLogoDataUri();
    }
  }

  /**
   * Formatea fecha ISO a DD/MM/YYYY para SUNAT.
   */
  _fechaSunat(iso) {
    if (!iso) return '';
    const s = String(iso).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  /**
   * Construye la cadena para el QR: rucEmisor|codigoComprobante|serie-numero|igv|total|fechaEmision|tipoDocCliente|rucCliente|codigoHash
   */
  _buildQrString(empresa, venta, cliente) {
    const rucEmisor = (empresa && empresa.ruc) ? String(empresa.ruc).trim() : '';
    const codigo = (venta && venta.codigoComprobante) ? String(venta.codigoComprobante).trim() : '01';
    const serieNum = (venta && venta.compVenta) ? String(venta.compVenta).trim() : '';
    const igv = (venta && venta.igv != null) ? Number(venta.igv).toFixed(2) : '0.00';
    const total = (venta && venta.total != null) ? Number(venta.total).toFixed(2) : '0.00';
    const fecha = this._fechaSunat(venta && venta.fEmision);
    const tipoDoc = (cliente && cliente.tipoDocSunat) ? String(cliente.tipoDocSunat).trim() : '6';
    const rucCliente = (cliente && cliente.ruc) ? String(cliente.ruc).trim() : '';
    const hash = (venta && venta.resumenHash) ? String(venta.resumenHash).trim() : '';
    return [rucEmisor, codigo, serieNum, igv, total, fecha, tipoDoc, rucCliente, hash].join('|');
  }

  /**
   * Construye HTML para comprobante en formato TICKET (80mm, térmico).
   * Misma estructura que factura electrónica: empresa, comprobante, cliente, ítems, totales, SON, bloque final con QR.
   */
  _buildTicketComprobanteHtml(data) {
    const {
      empresa, venta, titulo, compVenta, fEmision,
      logoSrc, razonSocial, dirCliente, rucCliente,
      filasItems, lineasTotales, cantidadLetras,
      textoRepresentacion, resumenHash, qrDataUri,
      idVenta = '', barcodeIdVentaUrl = '',
      observaciones = ''
    } = data;
    const total = Number(venta.total) || 0;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${compVenta}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 8px; margin: 0; padding: 4px; color: #000; width: 80mm; max-width: 80mm; }
    .ticket-center { text-align: center; }
    .ticket-logo { max-width: 50px; max-height: 40px; margin: 0 auto 2px; display: block; }
    .ticket-empresa { font-weight: bold; font-size: 9px; margin: 2px 0; line-height: 1.2; }
    .ticket-ruc { font-size: 7px; }
    .ticket-dir, .ticket-rubro, .ticket-cel, .ticket-correo { font-size: 6px; margin: 1px 0; }
    .ticket-sep { border: none; border-top: 1px dashed #000; margin: 4px 0; }
    .ticket-comprobante { font-weight: bold; font-size: 9px; margin: 2px 0; }
    .ticket-fecha { font-size: 7px; margin-bottom: 4px; }
    .ticket-cliente { text-align: left; font-size: 7px; line-height: 1.25; margin: 4px 0; }
    .ticket-cliente strong { display: inline; }
    table.ticket-detalle { width: 100%; border-collapse: collapse; font-size: 7px; margin: 4px 0; }
    table.ticket-detalle th, table.ticket-detalle td { padding: 1px 2px; border-bottom: 1px solid #eee; }
    table.ticket-detalle th { text-align: left; font-weight: bold; }
    .ticket-detalle .num { text-align: right; }
    .ticket-totales { font-size: 7px; margin: 4px 0; }
    .ticket-totales td.num { text-align: right; }
    .ticket-totales tr.total-final { font-weight: bold; font-size: 8px; }
    .ticket-son { font-size: 7px; margin: 4px 0; border-top: 1px dashed #000; padding-top: 4px; }
    .ticket-final { margin-top: 6px; padding: 4px 0; font-size: 6px; }
    .ticket-final .txt { margin-bottom: 2px; }
    .ticket-final .qr-wrap { text-align: center; margin-top: 4px; }
    .ticket-final .qr-wrap img { width: 70px; height: 70px; }
    .ticket-final .barcode-venta { margin-top: 4px; font-size: 6px; }
    .ticket-final .barcode-venta img { height: 28px; width: auto; max-width: 60mm; }
  </style>
</head>
<body>
  <div class="ticket-center">
    <img src="${logoSrc}" alt="Logo" class="ticket-logo" onerror="this.style.display='none'">
    <div class="ticket-empresa">${empresa.nombre || ''}</div>
    ${empresa.direccion ? '<div class="ticket-dir">' + empresa.direccion + '</div>' : ''}
    <div class="ticket-ruc">RUC: ${empresa.ruc || ''}</div>
    ${empresa.rubro ? '<div class="ticket-rubro">' + empresa.rubro + '</div>' : ''}
    ${empresa.telefono ? '<div class="ticket-cel">CEL: ' + empresa.telefono + '</div>' : ''}
    ${empresa.correo ? '<div class="ticket-correo">' + empresa.correo + '</div>' : ''}
  </div>
  <hr class="ticket-sep">
  <div class="ticket-center">
    <div class="ticket-comprobante">${titulo}</div>
    <div>${compVenta}</div>
    <div class="ticket-fecha">Fecha: ${fEmision}</div>
  </div>
  <hr class="ticket-sep">
  <div class="ticket-cliente">
    <strong>RUC:</strong> ${rucCliente || '-'}<br>
    <strong>RAZÓN SOCIAL:</strong> ${razonSocial || '-'}<br>
    <strong>DIRECCIÓN:</strong> ${dirCliente || '-'}
  </div>
  <hr class="ticket-sep">
  <table class="ticket-detalle">
    <thead><tr><th>Cant</th><th>Descripción</th><th class="num">P.Unit</th><th class="num">Importe</th></tr></thead>
    <tbody>${filasItems}</tbody>
  </table>
  <hr class="ticket-sep">
  <table class="ticket-totales" style="width:100%; font-size:7px;">
    ${lineasTotales}
  </table>
  <div class="ticket-son"><strong>SON:</strong> ${cantidadLetras || ''}</div>
  ${observaciones ? '<hr class="ticket-sep"><div style="font-size:7px;"><strong>OBSERVACIONES:</strong><br>' + (observaciones || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : ''}
  ${data.tablaCuotasHtml || ''}
  <div class="ticket-final">
    ${textoRepresentacion ? '<div class="txt">' + textoRepresentacion + '</div>' : ''}
    ${qrDataUri ? '<div class="txt">Visite https://mifacturasunat.com</div>' : ''}
    ${resumenHash ? '<div class="txt">Resumen: ' + resumenHash + '</div>' : ''}
    ${qrDataUri ? '<div class="qr-wrap"><img src="' + qrDataUri + '" alt="QR"/></div>' : ''}
    ${barcodeIdVentaUrl ? '<div class="barcode-venta">Venta: ' + idVenta + '<br><img src="' + barcodeIdVentaUrl + '" alt="' + idVenta + '"/></div>' : ''}
  </div>
</body>
</html>`;
  }

  /**
   * Construye HTML para comprobante de venta (factura/boleta) A4, A5 o ticket.
   * @param {Object} params - empresa, venta, cliente, items, cantidadLetras, formato
   */
  async construirHtmlComprobanteVenta(params) {
    const QRCode = require('qrcode');
    const safeParams = params && typeof params === 'object' ? params : {};
    const {
      empresa = {},
      venta = {},
      cliente = {},
      items = [],
      cantidadLetras = '',
      formato = 'A4',
      esCotizacion = false
    } = safeParams;

    const titulo = venta.nombreComprobante || 'Comprobante';
    const compVenta = venta.compVenta || '';
    const fEmision = venta.fEmision || '';
    const idVenta = venta.idVenta != null ? String(venta.idVenta) : '';
    const barcodeIdVentaUrl = idVenta
      ? 'https://barcode.tec-it.com/barcode.ashx?data=' + encodeURIComponent(idVenta) + '&code=Code128&translate=esc'
      : '';
    const subtotal = Number(venta.subtotal) || 0;
    const igv = Number(venta.igv) || 0;
    const exonerado = Number(venta.exonerado) || 0;
    const gratuito = Number(venta.gratuito) || 0;
    const otrosCargos = Number(venta.otrosCargos) || 0;
    const descuentos = Number(venta.descuentos) || 0;
    const total = Number(venta.total) || 0;
    const resumenHash = esCotizacion ? '' : ((venta.resumenHash && String(venta.resumenHash).trim()) || '');

    const logoSrc = await this._resolveLogoToDataUri(empresa.logo);
    let qrDataUri = '';
    if (!esCotizacion) {
      const qrString = this._buildQrString(empresa, venta, cliente);
      try {
        qrDataUri = await QRCode.toDataURL(qrString, { width: formato === 'ticket' ? 80 : 120, margin: 1 });
      } catch (e) {
        qrDataUri = this._defaultLogoDataUri();
      }
    }

    const filas = items.map(it => {
      const desc = it.descripcion || it.desc || '';
      const cant = Number(it.cantidad) != null ? Number(it.cantidad) : 0;
      const pUnit = Number(it.pVenta) != null ? Number(it.pVenta) : Number(it.pUnit) || 0;
      const importe = Number(it.total) != null ? Number(it.total) : (Number(it.subtotal) || cant * pUnit);
      return `<tr><td class="text-center">${cant}</td><td>${desc}</td><td class="text-end">${pUnit.toFixed(2)}</td><td class="text-end">${importe.toFixed(2)}</td></tr>`;
    }).join('');

    const razonSocial = cliente.rSocial || cliente.razonSocial || '';
    const dirCliente = cliente.direccion || '';

    const lineasTotales = [
      { label: 'Subtotal', value: subtotal },
      ...(exonerado > 0 ? [{ label: 'Exonerado', value: exonerado }] : []),
      { label: 'IGV (18%)', value: igv },
      ...(gratuito > 0 ? [{ label: 'Gratuito', value: gratuito }] : []),
      ...(otrosCargos > 0 ? [{ label: 'Otros cargos', value: otrosCargos }] : []),
      { label: 'Descuentos', value: descuentos },
      { label: 'TOTAL (S/)', value: total, total: true }
    ];
    const filasTotales = lineasTotales.map(l => `
      <tr${l.total ? ' class="total-row"' : ''}><td>${l.label}</td><td class="text-end">${Number(l.value).toFixed(2)}</td></tr>`).join('');

    const esFactura = (venta.codigoComprobante || '01') === '01';
    const textoRepresentacion = esCotizacion ? '' : (esFactura ? 'Representación impresa de la FACTURA ELECTRÓNICA' : 'Representación impresa de la BOLETA DE VENTA ELECTRÓNICA');

    const observaciones = (venta.observaciones && String(venta.observaciones).trim()) || (venta.compRelacionado && String(venta.compRelacionado).trim()) || '';
    const cuotas = Array.isArray(venta.cuotas) ? venta.cuotas : [];
    const tablaCuotasHtml = cuotas.length > 0 && esFactura
      ? `<div class="cuotas-section" style="margin-top:16px; page-break-inside:avoid;">
          <strong>Detalle de cuotas a pagar</strong>
          <table class="detalle" style="margin-top:6px;">
            <thead><tr><th>Fecha de pago</th><th>Nro. cuota</th><th class="text-end">Total (S/)</th></tr></thead>
            <tbody>${cuotas.map(c => `<tr><td>${c.fechaPago || '—'}</td><td class="text-center">${c.numeroCuota != null ? c.numeroCuota : '—'}</td><td class="text-end">${Number(c.total != null ? c.total : c.montoCuota || 0).toFixed(2)}</td></tr>`).join('')}</tbody>
          </table>
        </div>`
      : '';

    if (formato === 'ticket') {
      const rucCliente = cliente.ruc != null && String(cliente.ruc).trim() !== '' ? String(cliente.ruc).trim() : '';
      const ticketTotalesHtml = lineasTotales.map(l =>
        `<tr${l.total ? ' class="total-final"' : ''}><td>${l.label}</td><td class="num" style="text-align:right">${Number(l.value).toFixed(2)}</td></tr>`
      ).join('');
      const ticketCuotasHtml = cuotas.length > 0 && esFactura
        ? `<hr class="ticket-sep"><div style="font-size:7px;"><strong>Cuotas a pagar</strong><table style="width:100%;font-size:6px;border-collapse:collapse;"><tr><th>F.Pago</th><th>Nro</th><th class="num">Total</th></tr>${cuotas.map(c => `<tr><td>${c.fechaPago || '—'}</td><td>${c.numeroCuota != null ? c.numeroCuota : '—'}</td><td class="num">${Number(c.total != null ? c.total : c.montoCuota || 0).toFixed(2)}</td></tr>`).join('')}</table></div>`
        : '';
      return this._buildTicketComprobanteHtml({
        empresa,
        venta,
        titulo,
        compVenta,
        fEmision,
        logoSrc,
        razonSocial,
        dirCliente,
        rucCliente,
        filasItems: filas,
        lineasTotales: ticketTotalesHtml,
        cantidadLetras,
        textoRepresentacion,
        resumenHash,
        qrDataUri,
        idVenta,
        barcodeIdVentaUrl,
        tablaCuotasHtml: ticketCuotasHtml,
        observaciones
      });
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${compVenta}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 16px; color: #222; }
    .header { border-bottom: 3px solid #0056b3; padding-bottom: 12px; margin-bottom: 14px; }
    .logo-cell { width: 26%; vertical-align: top; }
    .logo { max-width: 150px; max-height: 95px; height: auto; display: block; object-fit: contain; }
    .datos-empresa { padding-left: 12px; }
    .datos-empresa h3 { margin: 0 0 6px 0; color: #0056b3; font-size: 14px; font-weight: bold; }
    .datos-empresa p { margin: 0; line-height: 1.4; font-size: 9px; color: #444; }
    .comprobante-box { text-align: right; vertical-align: top; }
    .comprobante-box .tipo { font-size: 14px; font-weight: bold; color: #0056b3; margin-bottom: 4px; }
    .comprobante-box .numero { font-size: 12px; margin-bottom: 2px; }
    .comprobante-box .fecha { font-size: 9px; color: #555; }
    .datos-cliente { margin: 12px 0; padding: 10px 12px; border: 1px solid #ccc; background: #fafafa; font-size: 9px; }
    .datos-cliente .linea { margin: 2px 0; }
    table.detalle { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 9px; }
    table.detalle th, table.detalle td { border: 1px solid #bbb; padding: 6px 8px; }
    table.detalle th { background: #e8e8e8; font-weight: bold; color: #333; }
    table.detalle tbody tr:nth-child(even) { background: #f9f9f9; }
    .text-end { text-align: right; }
    .text-center { text-align: center; }
    .totales-box { margin-top: 14px; width: 280px; margin-left: auto; }
    .totales-box table { width: 100%; font-size: 10px; border-collapse: collapse; }
    .totales-box td { padding: 4px 8px; border: 1px solid #ddd; }
    .totales-box td:first-child { background: #f5f5f5; }
    .totales-box .total-row td { font-weight: bold; background: #e8eef4; font-size: 11px; }
    .son { margin-top: 14px; padding: 8px; font-size: 10px; border: 1px solid #eee; background: #fafafa; }
    .son strong { color: #0056b3; }
    .bloque-final { margin-top: 20px; border: 1px solid #333; padding: 10px 12px; overflow: hidden; }
    .bloque-final .texto { float: left; width: 70%; font-size: 8px; line-height: 1.4; }
    .bloque-final .qr { float: right; width: 28%; text-align: right; }
    .bloque-final .qr img { width: 100px; height: 100px; }
    .bloque-final .barcode-venta { margin-top: 8px; clear: both; font-size: 8px; }
    .bloque-final .barcode-venta img { height: 36px; width: auto; max-width: 180px; }
  </style>
</head>
<body>
  <div class="header">
    <table style="width:100%; border:none;">
      <tr>
        <td class="logo-cell" style="border:none;">
          <img src="${logoSrc}" alt="Logo" class="logo" onerror="this.src='${this._defaultLogoDataUri()}'; this.onerror=null;">
        </td>
        <td style="border:none; padding-left:12px;">
          <div class="datos-empresa">
            <h3>${empresa.nombre || ''}</h3>
            <p>
              ${empresa.ruc ? 'RUC: ' + empresa.ruc + '<br>' : ''}
              ${empresa.direccion ? 'Dirección: ' + empresa.direccion + '<br>' : ''}
              ${empresa.rubro ? 'Rubro: ' + empresa.rubro + '<br>' : ''}
              ${empresa.telefono ? 'Cel: ' + empresa.telefono + '<br>' : ''}
              ${empresa.correo ? 'Correo: ' + empresa.correo : ''}
            </p>
          </div>
        </td>
        <td class="comprobante-box" style="border:none;">
          <div class="tipo">${titulo}</div>
          <div class="numero">${compVenta}</div>
          <div class="fecha">Fecha de emisión: ${fEmision}</div>
        </td>
      </tr>
    </table>
  </div>
  <div class="datos-cliente">
    <strong>DATOS DEL CLIENTE</strong>
    <div class="linea"><strong>RUC:</strong> ${cliente.ruc != null && String(cliente.ruc).trim() !== '' ? String(cliente.ruc).trim() : '-'}</div>
    <div class="linea"><strong>RAZÓN SOCIAL:</strong> ${razonSocial || '-'}</div>
    <div class="linea"><strong>DIRECCIÓN:</strong> ${dirCliente || '-'}</div>
  </div>
  <table class="detalle">
    <thead><tr><th class="text-center" style="width:10%;">Cant.</th><th style="width:44%;">Descripción</th><th class="text-end" style="width:18%;">P. Unit. (S/)</th><th class="text-end" style="width:18%;">Importe (S/)</th></tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="totales-box">
    <table>${filasTotales}</table>
  </div>
  <div class="son"><strong>SON:</strong> ${cantidadLetras || ''}</div>
  ${observaciones ? '<div class="observaciones" style="margin-top:12px;padding:8px;border:1px solid #eee;background:#fafafa;font-size:9px;"><strong>OBSERVACIONES:</strong><br>' + (observaciones || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : ''}
  ${tablaCuotasHtml}
  <div class="bloque-final">
    ${(textoRepresentacion || resumenHash) ? `<div class="texto">${textoRepresentacion ? textoRepresentacion + '<br>' : ''}${qrDataUri ? 'Visite https://mifacturasunat.com<br>' : ''}${resumenHash ? 'Resumen: ' + resumenHash : ''}</div>` : ''}
    ${qrDataUri ? '<div class="qr"><img src="' + qrDataUri + '" alt="QR"/></div>' : ''}
    ${barcodeIdVentaUrl ? '<div class="barcode-venta">Código venta (despachos): <img src="' + barcodeIdVentaUrl + '" alt="' + idVenta + '"/><br><span>' + idVenta + '</span></div>' : ''}
  </div>
</body>
</html>`;
  }
}

module.exports = new HtmlBuilderService();