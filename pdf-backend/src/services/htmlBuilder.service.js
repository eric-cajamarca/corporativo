class HtmlBuilderService {
  /**
   * Ancho en píxeles del PNG del QR (node-qrcode). El tamaño físico en el PDF lo define CSS (cm).
   * Ticket ~2 cm papel térmico; A4/A5 ~3 cm estándar comercial.
   */
  _qrBitmapWidthPx(formato) {
    return formato === 'ticket' ? 300 : 420;
  }

  _escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** PDF ventas: solo calle; sin ubigeo/códigos SUNAT al final. */
  _direccionClienteLegible(texto) {
    let s = String(texto ?? '').trim();
    if (!s) return '';
    let prev;
    do {
      prev = s;
      s = s
        .replace(/\s+\d{6}(?:\s+\d{1,4}){0,2}(?:\s+\d{1,2})?\s*$/g, '')
        .replace(/\s+(?:PEN|PE)\s*$/gi, '')
        .trim();
    } while (s !== prev);
    return s;
  }

  /** Texto de ítem para PDF: descripción + marca si existe (sin HTML). */
  _descripcionProductoPdfLinea(it) {
    const item = it && typeof it === 'object' ? it : {};
    const base = String(item.descripcion ?? item.desc ?? item.productoDescripcion ?? '').trim();
    const marca = String(item.marca ?? item.nombreMarca ?? item.productoMarca ?? '').trim();
    if (marca && base) return `${base} - ${marca}`;
    if (marca) return marca;
    return base;
  }

  _normalizarCondicionPago(venta = {}) {
    const codigo = String(venta.codigoCondicionPago || '').trim();
    const raw = String(venta.condicionPago || '').trim().toLowerCase();
    if (codigo === '010' || raw.includes('credito') || raw.includes('crédito')) return 'CRÉDITO';
    if (codigo === '009' || raw.includes('contado')) return 'CONTADO';
    return raw ? raw.toUpperCase() : 'CONTADO';
  }

  _numeroSeguro(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  _impuestoMontoSegunVenta(impuesto, venta) {
    const cod = String(impuesto?.codigoSunat || '').trim().toUpperCase();
    const desc = String(impuesto?.descripcion || '').trim().toUpperCase();

    const subtotal = this._numeroSeguro(venta?.subtotal);
    const igv = this._numeroSeguro(venta?.igv);
    const exonerado = this._numeroSeguro(venta?.exonerado);
    const gratuito = this._numeroSeguro(venta?.gratuito);
    const otrosCargos = this._numeroSeguro(venta?.otrosCargos);

    // Reglas por código SUNAT o descripción. Si no hay dato explícito, se aproxima por porcentaje sobre subtotal.
    if (cod === '1000' || desc.includes('IGV')) return igv;
    if (cod === '9997' || desc.includes('EXON')) return exonerado;
    if (cod === '9996' || desc.includes('GRATUIT')) return gratuito;
    if (desc.includes('OTRO') && desc.includes('CARGO')) return otrosCargos;
    if (cod === '2000' || desc.includes('ISC')) {
      // ISC no se persiste en cabecera; se aproxima por porcentaje sobre subtotal si existe.
      const pct = this._numeroSeguro(impuesto?.porcentaje);
      return pct > 0 ? (subtotal * pct) / 100 : 0;
    }

    const pct = this._numeroSeguro(impuesto?.porcentaje);
    return pct > 0 ? (subtotal * pct) / 100 : 0;
  }

  /** Catálogo Impuestos: estado puede venir como boolean, 0/1 o textos Activ/Inactiv. */
  _impuestoCatalogoEstaActivo(imp) {
    const e = imp?.estado;
    if (e === true || e === 1) return true;
    if (e === false || e === 0 || e == null) return false;
    const s = String(e).trim().toLowerCase();
    if (s === '0' || s === 'false' || s === 'inactivo' || s === 'inactiva' || s === 'no') return false;
    if (s === '1' || s === 'true' || s === 'activo' || s === 'activa' || s === 'si' || s === 'sí') return true;
    return !!e;
  }

  _lineasImpuestosDesdeCatalogo(impuestos, venta) {
    const list = Array.isArray(impuestos) ? impuestos : [];
    return list.map((imp) => {
      const activo = this._impuestoCatalogoEstaActivo(imp);
      const pct = this._numeroSeguro(imp?.porcentaje);
      const nombre = String(imp?.descripcion || 'Impuesto').trim() || 'Impuesto';
      const label = pct > 0 ? `${nombre} (${pct}%)` : nombre;
      const monto = activo ? this._impuestoMontoSegunVenta(imp, venta) : 0;
      return { label, value: monto };
    });
  }

  /**
   * Si el cliente PDF no envió el catálogo de impuestos (arreglo vacío), mostrar IGV y Exonerado desde cabecera Ventas.
   * Factura/boleta/NC/ND SUNAT (01, 03, 07, 08).
   */
  _lineasImpuestosFallbackSunatDesdeVenta(venta) {
    const igv = this._numeroSeguro(venta?.igv);
    const exo = this._numeroSeguro(venta?.exonerado);
    return [
      { label: 'IGV', value: igv },
      { label: 'Exonerado', value: exo }
    ];
  }

  _parseCuentasBancarias(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((x) => this._escapeHtml(x)).filter(Boolean);
    }
    const text = String(value).trim();
    if (!text) return [];
    return text
      .split(/\r?\n|[;|]/)
      .map((x) => this._escapeHtml(x.trim()))
      .filter(Boolean);
  }
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
   * Ticket de despacho: estilo cotización, solo negro sobre blanco, sin cajas grises/azules.
   * Encabezado con logo de empresa (data URI). Texto base 11px.
   */
  async construirHtmlDespachoTicketCotizacionBn(params) {
    const titulo = this._escapeHtml(String(params.titulo || 'Ticket de despacho'));
    const datos = params.datos && typeof params.datos === 'object' ? params.datos : {};
    const empresa = datos.empresa && typeof datos.empresa === 'object' ? datos.empresa : {};
    const venta = datos.venta && typeof datos.venta === 'object' ? datos.venta : {};
    const cliente = datos.cliente && typeof datos.cliente === 'object' ? datos.cliente : {};
    const dsp = datos.despacho && typeof datos.despacho === 'object' ? datos.despacho : null;
    const columnas = Array.isArray(params.columnas) ? params.columnas : [];
    const filas = Array.isArray(params.filas) ? params.filas : [];

    const logoSrc = await this._resolveLogoToDataUri(empresa.logo || '');
    const nombreEmp = this._escapeHtml(String(empresa.nombre || '').trim());
    const rucEmp = this._escapeHtml(String(empresa.ruc || '').trim());
    const dirEmp = this._escapeHtml(String(empresa.direccion || '').trim());
    const telEmp = this._escapeHtml(String(empresa.telefono || '').trim());

    const metaLines = [rucEmp ? `RUC: ${rucEmp}` : '', dirEmp ? `Dirección: ${dirEmp}` : '', telEmp ? `Tel.: ${telEmp}` : '']
      .filter(Boolean)
      .join('<br>');

    const bloqueDespacho = dsp
      ? `<div class="seccion">
  <div class="seccion-tit">Despacho</div>
  <div class="fila-kv"><span class="k">Tipo</span><span class="v">${this._escapeHtml(String(dsp.tipoDespacho || '—'))}</span></div>
  <div class="fila-kv"><span class="k">Fecha y hora</span><span class="v">${this._escapeHtml(String(dsp.fechaDespacho || '—'))}</span></div>
  <div class="fila-kv"><span class="k">Estado</span><span class="v">${this._escapeHtml(String(dsp.estado || '—'))}</span></div>
</div>`
      : '';

    const bloqueVenta =
      venta && Object.keys(venta).length && cliente && Object.keys(cliente).length
        ? `<div class="seccion">
  <div class="seccion-tit">Comprobante y cliente</div>
  <div class="fila-kv"><span class="k">Comprobante</span><span class="v">${this._escapeHtml(String(venta.compVenta || '—'))}</span></div>
  <div class="fila-kv"><span class="k">Cliente</span><span class="v">${this._escapeHtml(String(cliente.razonSocial || cliente.rSocial || '—'))}</span></div>
  <div class="fila-kv"><span class="k">RUC / DNI</span><span class="v">${this._escapeHtml(String(cliente.ruc || '—'))}</span></div>
  <div class="fila-kv"><span class="k">idVenta</span><span class="v">${this._escapeHtml(String(venta.idVenta ?? '—'))}</span></div>
</div>`
        : '';

    const th = columnas.map((c) => `<th>${this._escapeHtml(String(c))}</th>`).join('');
    const tr = filas
      .map((fila) => {
        const row = Array.isArray(fila) ? fila : [];
        const tds = row
          .map((celda) => {
            const v = celda !== undefined && celda !== null ? String(celda) : '';
            return `<td>${this._escapeHtml(v)}</td>`;
          })
          .join('');
        return `<tr>${tds}</tr>`;
      })
      .join('');

    const fechaRep = this._escapeHtml(new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }));

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 10px 8px; }
    .hdr-logo { text-align: center; margin-bottom: 6px; }
    .hdr-logo img { max-width: 160px; max-height: 72px; object-fit: contain; display: inline-block; vertical-align: middle; }
    .empresa-nombre { text-align: center; font-weight: bold; font-size: 11px; margin: 4px 0 2px; color: #000; }
    .empresa-meta { text-align: center; font-size: 10px; line-height: 1.35; color: #000; margin-bottom: 10px; }
    .titulo-doc { font-weight: bold; font-size: 12px; text-align: center; text-transform: uppercase; letter-spacing: 0.02em; margin: 10px 0 4px; padding-bottom: 4px; border-bottom: 1px solid #000; color: #000; }
    .fecha-doc { font-size: 10px; text-align: center; margin-bottom: 12px; color: #000; }
    .seccion { margin-bottom: 10px; padding: 8px 10px; border: 1px solid #000; background: #fff; }
    .seccion-tit { font-weight: bold; font-size: 11px; margin: 0 0 6px; padding-bottom: 3px; border-bottom: 1px solid #000; color: #000; }
    .fila-kv { display: table; width: 100%; font-size: 11px; margin-bottom: 3px; color: #000; }
    .fila-kv .k { display: table-cell; width: 34%; font-weight: bold; vertical-align: top; padding-right: 6px; }
    .fila-kv .v { display: table-cell; vertical-align: top; }
    table.prod { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 11px; color: #000; }
    table.prod th, table.prod td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; }
    table.prod th { background: #fff; font-weight: bold; text-align: center; }
  </style>
</head>
<body>
  <div class="hdr-logo"><img src="${logoSrc}" alt=""></div>
  ${nombreEmp ? `<div class="empresa-nombre">${nombreEmp}</div>` : ''}
  ${metaLines ? `<div class="empresa-meta">${metaLines}</div>` : ''}
  <div class="titulo-doc">${titulo}</div>
  <div class="fecha-doc">Impreso: ${fechaRep}</div>
  ${bloqueDespacho}
  ${bloqueVenta}
  <table class="prod"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>
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
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="56" viewBox="0 0 120 56"><rect width="120" height="56" fill="#fff" stroke="#000" stroke-width="1"/><text x="60" y="30" dominant-baseline="middle" text-anchor="middle" fill="#000" font-size="10" font-family="Arial">Sin logo</text></svg>';
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
    const codigoRaw = (venta && venta.codigoComprobante) ? String(venta.codigoComprobante).trim() : '01';
    const codigo = this._normalizarCodigoTipoSunatParaQr(codigoRaw);
    const serieNum = (venta && venta.compVenta) ? String(venta.compVenta).trim() : '';
    const igv = (venta && venta.igv != null) ? Number(venta.igv).toFixed(2) : '0.00';
    const total = (venta && venta.total != null) ? Number(venta.total).toFixed(2) : '0.00';
    const fecha = this._fechaSunat(venta && venta.fEmision);
    const tipoDoc = (cliente && cliente.tipoDocSunat) ? String(cliente.tipoDocSunat).trim() : '6';
    const rucCliente = (cliente && cliente.ruc) ? String(cliente.ruc).trim() : '';
    const hash = (venta && venta.resumenHash) ? String(venta.resumenHash).trim() : '';
    return [rucEmisor, codigo, serieNum, igv, total, fecha, tipoDoc, rucCliente, hash].join('|');
  }

  /** Comprobantes con QR y leyenda SUNAT (Facturador). No NV ni CT ni cotización. */
  _codigosComprobanteConQrSunat() {
    return new Set(['01', '03', '07', '08']);
  }

  /**
   * Códigos internos de NC/ND (F7/B7, F8/B8) → tipo SUNAT para QR y leyenda impresa.
   */
  _normalizarCodigoTipoSunatParaQr(codigoComp) {
    const c = String(codigoComp || '').trim().toUpperCase();
    if (c === 'F7' || c === 'B7') return '07';
    if (c === 'F8' || c === 'B8') return '08';
    return String(codigoComp || '').trim() || '01';
  }

  /** Factura, boleta, NC y ND electrónicas: columna U. MEDIDA y formato ticket con código de presentación. */
  _esComprobanteConUnidadMedidaPdf(codigoComp) {
    const c = this._normalizarCodigoTipoSunatParaQr(codigoComp);
    return c === '01' || c === '03' || c === '07' || c === '08';
  }

  _debeMostrarQrYPieSunat(esCotizacion, codigoComprobante) {
    const cod = String(codigoComprobante || '').trim();
    if (esCotizacion || cod === 'CT' || cod === 'NV') return false;
    const codNorm = this._normalizarCodigoTipoSunatParaQr(cod);
    return this._codigosComprobanteConQrSunat().has(codNorm);
  }

  _tituloRepresentacionElectronica(codigo) {
    const c = this._normalizarCodigoTipoSunatParaQr(codigo);
    const map = {
      '01': 'FACTURA ELECTRÓNICA',
      '03': 'BOLETA DE VENTA ELECTRÓNICA',
      '07': 'NOTA DE CRÉDITO ELECTRÓNICA',
      '08': 'NOTA DE DÉBITO ELECTRÓNICA'
    };
    return map[c] || 'COMPROBANTE DE PAGO ELECTRÓNICO';
  }

  /**
   * Título visible en cabecera/ticket del PDF (no usa nombre del catálogo con abreviaturas ni "(Factura/Boleta)").
   */
  _tituloCabeceraComprobanteVenta(codigoComp, nombreComprobanteDb) {
    const c = String(codigoComp || '').trim().toUpperCase();
    if (c === '07' || c === 'F7' || c === 'B7') {
      return 'Nota de crédito Electrónica';
    }
    if (c === '08' || c === 'F8' || c === 'B8') {
      return 'Nota de débito Electrónica';
    }
    const nom = nombreComprobanteDb != null ? String(nombreComprobanteDb).trim() : '';
    return nom || 'Comprobante';
  }

  /** Códigos internos (F7/B7/F8/B8) o SUNAT (07/08) para NC y ND en PDF. */
  _esNotaCreditoDebitoElectronica(codigoComp) {
    const c = String(codigoComp || '').trim().toUpperCase();
    return new Set(['07', '08', 'F7', 'B7', 'F8', 'B8']).has(c);
  }

  _esNotaCreditoPdf(codigoComp) {
    const c = String(codigoComp || '').trim().toUpperCase();
    return c === '07' || c === 'F7' || c === 'B7';
  }

  _normalizarCodigoMotivoSunat(codigo, defaultCode = '01') {
    const s = String(codigo != null ? codigo : '').trim();
    if (!s) return defaultCode;
    const n = parseInt(String(s).replace(/\D/g, '') || defaultCode, 10);
    if (!Number.isFinite(n) || n < 1 || n > 99) return defaultCode;
    return String(n).padStart(2, '0');
  }

  /** Catálogo SUNAT 01: documento de referencia de la NC/ND. */
  _etiquetaTipoComprobanteRefSunat(tipo) {
    const t = String(tipo || '01').trim();
    if (t === '03') return 'Boleta de venta electrónica';
    if (t === '01') return 'Factura electrónica';
    return `Comprobante (${t})`;
  }

  /** Catálogo SUNAT 09 — motivo de nota de crédito. */
  _descripcionMotivoNotaCreditoSunat(codigo) {
    const c = this._normalizarCodigoMotivoSunat(codigo, '01');
    const map = {
      '01': 'Anulación de la operación',
      '02': 'Anulación por error en el RUC',
      '03': 'Corrección por error en la descripción',
      '04': 'Descuento global',
      '05': 'Descuento por ítem',
      '06': 'Devolución total',
      '07': 'Devolución por ítem',
      '08': 'Disminución en el valor',
      '09': 'Otros conceptos',
      '10': 'Ajustes de operaciones de exportación',
      '11': 'Ajustes afectos al IVAP',
      '12': 'Beneficio al consumidor — decremento de precio',
      '13': 'Beneficio al consumidor — venta con beneficio'
    };
    return map[c] || 'Motivo de nota de crédito';
  }

  /** Catálogo SUNAT 10 — motivo de nota de débito. */
  _descripcionMotivoNotaDebitoSunat(codigo) {
    const c = this._normalizarCodigoMotivoSunat(codigo, '01');
    const map = {
      '01': 'Intereses por mora',
      '02': 'Aumento en el valor',
      '03': 'Penalidades / otros'
    };
    return map[c] || 'Motivo de nota de débito';
  }

  /**
   * Bloque HTML (líneas en datos del cliente) con documento modificado y motivo; solo NC/ND.
   * @returns {{ bloqueA4: string, bloqueTicket: string }}
   */
  _htmlDocumentoYMotivoNotaCreditoDebito(venta, codigoComp) {
    if (!this._esNotaCreditoDebitoElectronica(codigoComp)) {
      return { bloqueA4: '', bloqueTicket: '' };
    }
    const compRel = (venta.compRelacionado && String(venta.compRelacionado).trim()) || '—';
    const tipoRef = venta.tipoComprobanteRef != null ? String(venta.tipoComprobanteRef).trim() : '01';
    const tipoLbl = this._etiquetaTipoComprobanteRefSunat(tipoRef);
    const codMotRaw = venta.codigoMotivoNotaCredito != null ? String(venta.codigoMotivoNotaCredito).trim() : '';
    const codMot = this._normalizarCodigoMotivoSunat(codMotRaw, '01');
    const esNc = this._esNotaCreditoPdf(codigoComp);
    const descMot = esNc
      ? this._descripcionMotivoNotaCreditoSunat(codMot)
      : this._descripcionMotivoNotaDebitoSunat(codMot);
    const escComp = this._escapeHtml(compRel);
    const escTipo = this._escapeHtml(tipoLbl);
    const escCod = this._escapeHtml(codMot);
    const escDesc = this._escapeHtml(descMot);
    const bloqueA4 = `
    <div class="linea"><strong>DOCUMENTO QUE MODIFICA:</strong> ${escComp}</div>
    <div class="linea"><strong>MOTIVO:</strong> ${escDesc}</div>`;
    const bloqueTicket = `<br><strong>DOC. QUE MODIFICA:</strong> ${escComp}<br><strong>MOTIVO:</strong> ${escDesc}<br>`;
    return { bloqueA4, bloqueTicket };
  }

  /** Pie legal SUNAT al final del PDF (hash viene de ComprobantesElectronicos al generar XML). */
  _htmlPieSunatElectronico(codigoComprobante, resumenHash) {
    const titulo = this._tituloRepresentacionElectronica(codigoComprobante);
    const hashEsc = (resumenHash && String(resumenHash).trim())
      ? String(resumenHash).trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : '—';
    return `<div class="pie-sunat-electronico" style="font-size:8px;line-height:1.45;text-align:left;margin:0;padding:0;color:#000;">
      <div>* Bienes transferidos en la Amazonía para ser consumidos en la misma</div>
      <div>* Representación impresa de ${titulo}</div>
      <div>* Generado desde el sistema del contribuyente</div>
      <div>* Resumen código H: ${hashEsc}</div>
      <div>* Consultar el comprobante en el portal SUNAT con su CLAVE SOL</div>
    </div>`;
  }

  /**
   * Construye HTML para comprobante en formato TICKET (80mm, térmico).
   * Misma estructura que factura electrónica: empresa, comprobante, cliente, ítems, totales, SON, bloque final con QR.
   * @param {number} [data.ticketLogoMaxWidthPx] - Ancho logo ticket (px); con `width` escala también logos pequeños.
   * @param {number} [data.ticketLogoMaxHeightPx] - Alto máximo logo (px).
   */
  _buildTicketComprobanteHtml(data) {
    const {
      empresa, venta, titulo, compVenta, fEmision,
      logoSrc, razonSocial, dirCliente, rucCliente,
      filasItems, lineasTotales, cantidadLetras,
      qrDataUri, pieSunatHtml = '',
      barcodeIdVentaUrl = '',
      observaciones = '',
      notaCreditoDebitoClienteExtra = '',
      tablaCuotasHtml = '',
      ticketFontDetalle = 12,
      ticketFontTotales = 12,
      ticketFontTotalFinal = 14,
      ticketFontAuxInline = 9,
      /** Logo ticket: ancho deseado (px) fuerza escalado; alto máximo (px). Editar estos valores. */
      ticketLogoMaxWidthPx = 150,
      ticketLogoMaxHeightPx = 75
    } = data;
    const condicionPago = this._normalizarCondicionPago(venta);
    const fVencimiento = venta && venta.fVencimiento ? String(venta.fVencimiento).trim() : '';
    const cuentasBancarias = this._parseCuentasBancarias(empresa.cuentasBancarias);
    const total = Number(venta.total) || 0;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${compVenta}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; margin: 0; padding: 1px; color: #000; width: 80mm; max-width: 80mm; }
    .ticket-center { text-align: center; }
    .ticket-logo { width: ${ticketLogoMaxWidthPx}px; max-width: 100%; height: auto; max-height: ${ticketLogoMaxHeightPx}px; object-fit: contain; margin: 0 auto 2px; display: block; }
    .ticket-empresa { font-weight: bold; font-size: 11px; margin: 2px 0; line-height: 1.2; color: #000; }
    .ticket-ruc { font-size: 11px; color: #000; }
    .ticket-dir, .ticket-cel  { font-size: 11px; margin: 1px 0; color: #000; }
    .ticket-sep { border: none; border-top: 1px dashed #000; margin: 3px 0; }
    .ticket-comprobante { font-weight: bold; font-size: 11px; margin: 2px 0; color: #000; }
    .ticket-num-doc { font-size: 11px; color: #000; }
    
    .ticket-cliente { text-align: left; font-size: 11px; line-height: 1.25; margin: 4px 0; color: #000; }
    .ticket-cliente strong { display: inline; }
    table.ticket-detalle { width: 100%; border-collapse: collapse; font-size: ${ticketFontDetalle}px; margin: 4px 0; color: #000; }
    table.ticket-detalle th, table.ticket-detalle td { padding: 1px 2px; border-bottom: 1px solid #000; }
    table.ticket-detalle th { text-align: left; font-weight: bold; }
    table.ticket-detalle thead th.ticket-th-desc { text-align: left; border-bottom: none; padding-bottom: 2px; line-height: 1.2; }
    table.ticket-detalle thead tr.ticket-subhead th { border-top: none; padding-top: 2px; }
    .ticket-item-desc { text-align: left; font-weight: normal; vertical-align: top; line-height: 1.35; word-wrap: break-word; padding: 4px 2px 2px; border-bottom: none !important; }
    tr.ticket-item-nums td { padding-top: 2px; padding-bottom: 5px; border-bottom: 1px solid #000; }
    .ticket-detalle .num { text-align: right; }
    .ticket-totales { font-size: ${ticketFontTotales}px; margin: 4px 0; color: #000; }
    .ticket-totales td.num { text-align: right; }
    .ticket-totales tr.total-final { font-weight: bold; font-size: ${ticketFontTotalFinal}px; }
    .ticket-son { font-size: ${ticketFontTotales}px; margin: 4px 0; border-top: 1px dashed #000; padding-top: 4px; color: #000; }
    .ticket-final { margin-top: 2px; padding: 0; font-size: 11px; color: #000; }
    .ticket-final .txt { margin-bottom: 2px; }
    .ticket-sunat-row { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 4px; margin-top: 4px; width: 100%; }
    .ticket-sunat-text { flex: 1; min-width: 0; text-align: left; color: #000; }
    .ticket-sunat-text .pie-sunat-electronico { font-size: 11px !important; line-height: 1.35 !important; margin: 0 !important; color: #000 !important; }
    .ticket-sunat-text .pie-sunat-electronico div { color: #000 !important; }
    .ticket-final .pie-sunat-electronico { font-size: 11px !important; line-height: 1.35 !important; color: #000 !important; }
    .ticket-final .pie-sunat-electronico div { color: #000 !important; }
    .ticket-sunat-qr { flex-shrink: 0; }
    .ticket-sunat-qr img { width: 2cm; height: 2cm; max-width: 100%; object-fit: contain; display: block; }
    .ticket-final .barcode-venta { margin-top: 1px; text-align: center; }
    .ticket-final .barcode-venta img { height: 28px; width: auto; max-width: 60mm; }
    .ticket-qr-final { text-align: center; margin: 0; padding: 0; width: 100%; line-height: 0; }
    .ticket-qr-final img { width: 2cm; height: 2cm; max-width: calc(100% - 2px); box-sizing: border-box; object-fit: contain; display: block; margin: 2px auto 0; }
  </style>
</head>
<body>
  <div class="ticket-center">
    <img src="${logoSrc}" alt="Logo" class="ticket-logo" onerror="this.style.display='none'">
    <div class="ticket-empresa">${this._escapeHtml(String(empresa.nombre || '').trim())}</div>
    <div class="ticket-ruc">RUC: ${this._escapeHtml(String(empresa.ruc || '').trim())}</div>
    ${(empresa.direccion && String(empresa.direccion).trim()) ? '<div class="ticket-dir">' + this._escapeHtml(String(empresa.direccion).trim()) + '</div>' : ''}
    ${(empresa.telefono && String(empresa.telefono).trim()) ? '<div class="ticket-cel">CEL: ' + this._escapeHtml(String(empresa.telefono).trim()) + '</div>' : ''}
   </div>
  <hr class="ticket-sep">
  <div class="ticket-center">
    <div class="ticket-comprobante">${titulo}</div>
    <div class="ticket-num-doc">${compVenta}</div>

  </div>
  <hr class="ticket-sep">
  <div class="ticket-cliente">
    <strong>RUC:</strong> ${rucCliente || '-'}<br>
    <strong>RAZÓN SOCIAL:</strong> ${razonSocial || '-'}<br>
    <strong>DIRECCIÓN:</strong> ${dirCliente || '-'}<br>
    <strong>COND. PAGO:</strong> ${condicionPago}<br>
    <strong>EMISIÓN:</strong> ${fEmision || '-'}
    ${fVencimiento ? '<br><strong>VENCIMIENTO:</strong> ' + this._escapeHtml(fVencimiento) : ''}
    ${notaCreditoDebitoClienteExtra || ''}
  </div>
  <hr class="ticket-sep">
  <table class="ticket-detalle">
    <thead>
      <tr><th colspan="3" class="ticket-th-desc">Producto / servicio</th></tr>
      <tr class="ticket-subhead"><th>Cant.</th><th class="num">P.Unit</th><th class="num">Importe</th></tr>
    </thead>
    <tbody>${filasItems}</tbody>
  </table>
  <hr class="ticket-sep">
  <table class="ticket-totales" style="width:100%;">
    ${lineasTotales}
  </table>
  <div class="ticket-son"><strong>SON:</strong> ${cantidadLetras || ''}</div>
  ${cuentasBancarias.length > 0 ? '<hr class="ticket-sep"><div style="font-size:' + ticketFontAuxInline + 'px;color:#000;"><strong>CUENTAS BANCARIAS:</strong><br>' + cuentasBancarias.join('<br>') + '</div>' : ''}
  ${observaciones ? '<hr class="ticket-sep"><div style="font-size:' + ticketFontAuxInline + 'px;color:#000;"><strong>OBSERVACIONES:</strong><br>' + (observaciones || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : ''}
  ${tablaCuotasHtml || ''}
  <div class="ticket-final">
    ${pieSunatHtml || ''}
    ${barcodeIdVentaUrl ? '<div class="barcode-venta"><img src="' + barcodeIdVentaUrl + '" alt="código"/></div>' : ''}
    ${qrDataUri ? '<div class="ticket-qr-final"><img src="' + qrDataUri + '" alt="QR"/></div>' : ''}
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
      impuestos = [],
      cantidadLetras = '',
      formato = 'A4',
      esCotizacion = false
    } = safeParams;

    const codigoComp = String(venta.codigoComprobante || '').trim();
    const titulo = this._tituloCabeceraComprobanteVenta(codigoComp, venta.nombreComprobante);
    const compVenta = venta.compVenta || '';
    const fEmision = venta.fEmision || '';
    const idVenta = venta.idVenta != null ? String(venta.idVenta) : '';
    const tieneVentaAgrupada =
      venta.idVentaAgrupada != null && String(venta.idVentaAgrupada).trim() !== '';
    /** Cliente + tabla de ítems en PDF A4/A5 (px). */
    const fontClienteDetalleA4A5 = 11.5;
    /** Fila TOTAL en caja de totales A4/A5. */
    const fontTotalAgrupada = tieneVentaAgrupada ? 12 : 11;
    const ticketFontDetalle = tieneVentaAgrupada ? 12 : 11;
    const ticketFontTotales = tieneVentaAgrupada ? 12 : 11;
    const ticketFontTotalFinal = tieneVentaAgrupada ? 12 : 11;
    const ticketFontAuxInline = tieneVentaAgrupada ? 12 : 11;
    const barcodeIdVentaUrl =
      tieneVentaAgrupada && idVenta
        ? 'https://barcode.tec-it.com/barcode.ashx?data=' + encodeURIComponent(idVenta) + '&code=Code128&translate=esc'
        : '';
    const subtotal = Number(venta.subtotal) || 0;
    const igv = Number(venta.igv) || 0;
    const exonerado = Number(venta.exonerado) || 0;
    const gratuito = Number(venta.gratuito) || 0;
    const otrosCargos = Number(venta.otrosCargos) || 0;
    const descuentos =
      venta.descuentosImpresion != null && venta.descuentosImpresion !== ''
        ? Number(venta.descuentosImpresion) || 0
        : Number(venta.descuentos) || 0;
    const total = Number(venta.total) || 0;
    const mostrarQrPie = this._debeMostrarQrYPieSunat(esCotizacion, codigoComp);
    const resumenHash = mostrarQrPie ? ((venta.resumenHash && String(venta.resumenHash).trim()) || '') : '';
    const pieSunatHtml = mostrarQrPie ? this._htmlPieSunatElectronico(codigoComp, resumenHash) : '';

    const logoSrc = await this._resolveLogoToDataUri(empresa.logo);
    let qrDataUri = '';
    if (mostrarQrPie) {
      const qrString = this._buildQrString(empresa, venta, cliente);
      try {
        qrDataUri = await QRCode.toDataURL(qrString, {
          width: this._qrBitmapWidthPx(formato),
          margin: 1,
          errorCorrectionLevel: 'M'
        });
      } catch (e) {
        qrDataUri = '';
      }
    }

    const incluirUnidadMedida = !esCotizacion && this._esComprobanteConUnidadMedidaPdf(codigoComp);

    const filasPlanas = (Array.isArray(items) ? items : []).map(it => {
      const desc = this._descripcionProductoPdfLinea(it);
      const cant = Number(it.cantidad) != null ? Number(it.cantidad) : 0;
      const pUnit = Number(it.pVenta) != null ? Number(it.pVenta) : Number(it.pUnit) || 0;
      const importe = Number(it.total) != null ? Number(it.total) : (Number(it.subtotal) || cant * pUnit);
      const um = (it.presentacion != null && String(it.presentacion).trim() !== '')
        ? String(it.presentacion).trim()
        : '';
      const codPres = (it.presentacionCodigo != null && String(it.presentacionCodigo).trim() !== '')
        ? String(it.presentacionCodigo).trim()
        : '';
      return { desc, cant, pUnit, importe, um, codPres };
    });

    const filas = incluirUnidadMedida
      ? filasPlanas.map(({ desc, cant, pUnit, importe, um }) =>
        `<tr><td class="text-center">${cant}</td><td>${this._escapeHtml(um)}</td><td>${this._escapeHtml(desc)}</td><td class="text-end">${pUnit.toFixed(2)}</td><td class="text-end">${importe.toFixed(2)}</td></tr>`
      ).join('')
      : filasPlanas.map(({ desc, cant, pUnit, importe }) =>
        `<tr><td class="text-center">${cant}</td><td>${this._escapeHtml(desc)}</td><td class="text-end">${pUnit.toFixed(2)}</td><td class="text-end">${importe.toFixed(2)}</td></tr>`
      ).join('');

    const filasTicket = incluirUnidadMedida
      ? filasPlanas.map(({ desc, cant, pUnit, importe, um, codPres }) => {
        const descProducto = codPres
          ? `${this._escapeHtml(codPres)} | ${this._escapeHtml(desc)}`
          : this._escapeHtml(desc);
        const lineaDesc = um
          ? `${this._escapeHtml(um)} · ${descProducto}`
          : descProducto;
        return `<tr><td colspan="3" class="ticket-item-desc">${lineaDesc}</td></tr>
<tr class="ticket-item-nums"><td>${cant}</td><td class="num">${pUnit.toFixed(2)}</td><td class="num">${importe.toFixed(2)}</td></tr>`;
      }).join('')
      : filasPlanas.map(({ desc, cant, pUnit, importe }) =>
        `<tr><td colspan="3" class="ticket-item-desc">${this._escapeHtml(desc)}</td></tr>
<tr class="ticket-item-nums"><td>${cant}</td><td class="num">${pUnit.toFixed(2)}</td><td class="num">${importe.toFixed(2)}</td></tr>`
      ).join('');

    const razonSocial = cliente.rSocial || cliente.razonSocial || '';
    const dirCliente = this._direccionClienteLegible(cliente.direccion || '');
    const condicionPago = this._normalizarCondicionPago(venta);
    const fVencimiento = venta.fVencimiento ? String(venta.fVencimiento).trim() : '';
    const cuentasBancarias = this._parseCuentasBancarias(empresa.cuentasBancarias);
    const usarColorPdf = formato !== 'ticket' && empresa.pdfUsarColor !== false;
    const colorPrimario = String(empresa.pdfColorPrimario || '#0B5FA5').trim() || '#0B5FA5';

    const codigoSunat = this._normalizarCodigoTipoSunatParaQr(codigoComp);
    const esComprobanteSunatValido = this._codigosComprobanteConQrSunat().has(codigoSunat);
    let lineasImpuestos = esComprobanteSunatValido
      ? this._lineasImpuestosDesdeCatalogo(impuestos, venta)
      : [];
    if (esComprobanteSunatValido && (!Array.isArray(lineasImpuestos) || lineasImpuestos.length === 0)) {
      lineasImpuestos = this._lineasImpuestosFallbackSunatDesdeVenta(venta);
    }
    const lineasTotales = [
      { label: 'Subtotal', value: subtotal },
      { label: 'Descuentos', value: descuentos },
      ...(esComprobanteSunatValido
        ? lineasImpuestos
        : [
            ...(exonerado > 0 ? [{ label: 'Exonerado', value: exonerado }] : []),
            { label: 'IGV (18%)', value: igv }
          ]),
      ...(gratuito > 0 ? [{ label: 'Gratuito', value: gratuito }] : []),
      ...(otrosCargos > 0 ? [{ label: 'Otros cargos', value: otrosCargos }] : []),
      { label: 'TOTAL (S/)', value: total, total: true }
    ];
    const filasTotalesHtml = lineasTotales.map(l =>
      `<tr${l.total ? ' class="total-row"' : ''}><td>${l.label}</td><td class="text-end">${Number(l.value).toFixed(2)}</td></tr>`
    ).join('');

    const mostrarCuotasPdf = codigoComp === '01' || codigoComp === '03';
    const esCredito = condicionPago === 'CRÉDITO';

    const esNcNd = this._esNotaCreditoDebitoElectronica(codigoComp);
    const { bloqueA4: htmlDocMotivoNcNd, bloqueTicket: htmlDocMotivoNcNdTicket } = this._htmlDocumentoYMotivoNotaCreditoDebito(
      venta,
      codigoComp
    );
    const observaciones = esNcNd
      ? ((venta.observaciones && String(venta.observaciones).trim()) || '')
      : ((venta.observaciones && String(venta.observaciones).trim()) ||
          (venta.compRelacionado && String(venta.compRelacionado).trim()) ||
          '');
    const cuotas = Array.isArray(venta.cuotas) ? venta.cuotas : [];
    const mostrarTablaCuotasMitad = mostrarCuotasPdf && esCredito && cuotas.length > 0;
    const tablaCuotasMitadHtml = mostrarTablaCuotasMitad
      ? `<div class="cuotas-mitad-inner">
          <div class="cuotas-mitad-titulo">Detalle de cuotas a pagar</div>
          <table class="detalle tabla-cuotas-compacta">
            <thead><tr><th>Fecha de pago</th><th>Nro. cuota</th><th class="text-end">Total (S/)</th></tr></thead>
            <tbody>${cuotas.map(c => `<tr><td>${this._escapeHtml(c.fechaPago || '—')}</td><td class="text-center">${c.numeroCuota != null ? this._escapeHtml(String(c.numeroCuota)) : '—'}</td><td class="text-end">${Number(c.total != null ? c.total : c.montoCuota || 0).toFixed(2)}</td></tr>`).join('')}</tbody>
          </table>
        </div>`
      : '';

    const hayCuentasMitad = cuentasBancarias.length > 0;
    const bloqueCuentasMitadHtml = hayCuentasMitad
      ? `<div class="cuentas-bancarias">
    <div class="titulo">CUENTAS BANCARIAS</div>
    ${cuentasBancarias.map((c) => `<div class="linea">${c}</div>`).join('')}
  </div>`
      : '';
    const partesColumnaAuxDer = [];
    if (mostrarTablaCuotasMitad) {
      partesColumnaAuxDer.push(tablaCuotasMitadHtml);
    }
    if (hayCuentasMitad) {
      if (mostrarTablaCuotasMitad) {
        partesColumnaAuxDer.push(`<div class="cuentas-bajo-cuotas">${bloqueCuentasMitadHtml}</div>`);
      } else {
        partesColumnaAuxDer.push(bloqueCuentasMitadHtml);
      }
    }
    const auxDerContenidoHtml = partesColumnaAuxDer.join('');
    const mostrarFilaQrAuxiliares = Boolean(qrDataUri || auxDerContenidoHtml);

    if (formato === 'ticket') {
      const rucCliente = cliente.ruc != null && String(cliente.ruc).trim() !== '' ? String(cliente.ruc).trim() : '';
      const ticketTotalesHtml = lineasTotales.map(l =>
        `<tr${l.total ? ' class="total-final"' : ''}><td>${l.label}</td><td class="num" style="text-align:right">${Number(l.value).toFixed(2)}</td></tr>`
      ).join('');
      const ticketCuotasHtml = cuotas.length > 0 && mostrarCuotasPdf
        ? `<hr class="ticket-sep"><div style="font-size:${ticketFontAuxInline}px;color:#000;"><strong>Cuotas a pagar</strong><table style="width:100%;font-size:${ticketFontAuxInline}px;border-collapse:collapse;color:#000;"><tr><th>F.Pago</th><th>Nro</th><th class="num">Total</th></tr>${cuotas.map(c => `<tr><td>${c.fechaPago || '—'}</td><td>${c.numeroCuota != null ? c.numeroCuota : '—'}</td><td class="num">${Number(c.total != null ? c.total : c.montoCuota || 0).toFixed(2)}</td></tr>`).join('')}</table></div>`
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
        filasItems: filasTicket,
        lineasTotales: ticketTotalesHtml,
        cantidadLetras,
        qrDataUri,
        pieSunatHtml,
        barcodeIdVentaUrl,
        tablaCuotasHtml: ticketCuotasHtml,
        observaciones,
        notaCreditoDebitoClienteExtra: htmlDocMotivoNcNdTicket,
        ticketFontDetalle,
        ticketFontTotales,
        ticketFontTotalFinal,
        ticketFontAuxInline
      });
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${titulo} ${compVenta}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; padding: 12px; color: #222; }
    .header { border-bottom: 3px solid ${usarColorPdf ? colorPrimario : '#0056b3'}; padding-bottom: 12px; margin-bottom: 14px; }
    .logo-cell { width: 26%; vertical-align: top; }
    .logo { max-width: 150px; max-height: 95px; height: auto; display: block; object-fit: contain; }
    .datos-empresa { padding-left: 12px; }
    .datos-empresa h3 { margin: 0 0 6px 0; color: ${usarColorPdf ? colorPrimario : '#0056b3'}; font-size: 14px; font-weight: bold; }
    .datos-empresa p { margin: 0; line-height: 1.4; font-size: 9px; color: #444; }
    .comprobante-box { text-align: right; vertical-align: top; border: none !important; outline: none; }
    .comprobante-box .tipo { font-size: 14px; font-weight: bold; color: ${usarColorPdf ? colorPrimario : '#0056b3'}; margin-bottom: 4px; }
    .comprobante-box .numero { font-size: 12px; margin-bottom: 2px; }
    .comprobante-box .fecha { font-size: 9px; color: #555; }
    .datos-cliente { margin: 12px 0; padding: 10px 12px; border: none; background: ${usarColorPdf ? '#eef6ff' : '#fafafa'}; font-size: ${fontClienteDetalleA4A5}px; border-radius: 6px; }
    .datos-cliente .linea { margin: 2px 0; }
    table.detalle { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: ${fontClienteDetalleA4A5}px; }
    table.detalle th, table.detalle td { border: 1px solid #bbb; padding: 6px 8px; }
    table.detalle th { background: ${usarColorPdf ? '#e2eefc' : '#e8e8e8'}; font-weight: bold; color: #333; }
    table.detalle tbody tr:nth-child(even) { background: #f9f9f9; }
    .text-end { text-align: right; }
    .text-center { text-align: center; }
    .post-detalle-row { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 14px; margin-top: 10px; width: 100%; }
    .post-detalle-izq { flex: 1; min-width: 0; text-align: left; align-self: flex-start; }
    .post-detalle-der { flex-shrink: 0; width: 280px; max-width: 40%; align-self: flex-start; }
    .son-bajo-total { margin-top: 0; font-size: 10px; padding: 0; border: none; background: transparent; line-height: 1.4; }
    .son-bajo-total strong { color: ${usarColorPdf ? colorPrimario : '#0056b3'}; }
    .totales-box { margin-top: 0; width: 100%; margin-left: 0; }
    .totales-box table { width: 100%; font-size: 10px; border-collapse: collapse; }
    .totales-box td { padding: 4px 8px; border: 1px solid #ddd; background: #fff; }
    .totales-box tr:not(.total-row):nth-child(odd) td:first-child { background: #f5f5f5; }
    .totales-box tr:not(.total-row):nth-child(even) td:first-child { background: #fff; }
    .totales-box .total-row td { font-weight: bold; background: ${usarColorPdf ? '#d7e8fb' : '#e8eef4'}; font-size: ${fontTotalAgrupada}px; }
    .pie-bajo-son { margin-top: 6px; }
    .pie-bajo-son .pie-sunat-electronico { margin: 0 !important; padding: 0 !important; }
    .fila-qr-auxiliares { display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: 6px; margin-top: 4px; width: 100%; page-break-inside: avoid; }
    .qr-izq-col { flex: 1; min-width: 0; text-align: center; margin: 0; padding: 0; line-height: 0; }
    .qr-izq-col img { width: 3cm; height: 3cm; max-width: 100%; box-sizing: border-box; object-fit: contain; display: block; margin: 6px auto 0; padding: 0; }
    .aux-der-col { flex-shrink: 0; width: 280px; max-width: 40%; align-self: flex-start; }
    .cuentas-bajo-cuotas { margin-top: 10px; }
    .bloque-final { margin-top: 10px; border: none; padding: 0; overflow: visible; background: transparent; border-radius: 0; }
    .cuentas-bancarias { padding: 8px 10px; border: none; background: ${usarColorPdf ? '#eef6ff' : '#fafafa'}; border-radius: 6px; font-size: 9px; }
    .cuentas-bancarias .titulo { font-weight: bold; color: ${usarColorPdf ? colorPrimario : '#333'}; margin-bottom: 4px; }
    .cuentas-bancarias .linea { margin: 2px 0; }
    .cuotas-mitad-titulo { font-weight: bold; font-size: 9px; margin-bottom: 6px; color: ${usarColorPdf ? colorPrimario : '#333'}; }
    table.tabla-cuotas-compacta { margin-top: 0; font-size: 8px; }
    table.tabla-cuotas-compacta th, table.tabla-cuotas-compacta td { padding: 4px 6px; }
    .pie-sunat-electronico > div { margin: 0 0 2px 0; padding: 0; }
    .pie-sunat-electronico > div:last-child { margin-bottom: 0; }
    .bloque-final .barcode-venta { margin: 6px 0 0 0; padding: 0; clear: both; text-align: center; }
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
              ${empresa.direccion ? 'Dirección: ' + empresa.direccion + '<br>' : ''}
              ${empresa.rubro ? 'Rubro: ' + empresa.rubro + '<br>' : ''}
              ${empresa.telefono ? 'Cel: ' + empresa.telefono + '<br>' : ''}
              ${empresa.correo ? 'Correo: ' + empresa.correo : ''}
            </p>
          </div>
        </td>
        <td class="comprobante-box" style="border:none;">
          <div class="tipo">${empresa.ruc ? 'RUC: ' + empresa.ruc + '<br>' : ''}</div>
          <div class="tipo">${titulo}</div>
          <div class="numero">${compVenta}</div>
        </td>
      </tr>
    </table>
  </div>
  <div class="datos-cliente">
    <strong>DATOS DEL CLIENTE</strong>
    <div class="linea"><strong>RUC:</strong> ${cliente.ruc != null && String(cliente.ruc).trim() !== '' ? String(cliente.ruc).trim() : '-'}</div>
    <div class="linea"><strong>RAZÓN SOCIAL:</strong> ${razonSocial || '-'}</div>
    <div class="linea"><strong>DIRECCIÓN:</strong> ${dirCliente || '-'}</div>
    <div class="linea"><strong>CONDICIÓN DE PAGO:</strong> ${condicionPago}</div>
    <div class="linea"><strong>FECHA DE EMISIÓN:</strong> ${fEmision || '-'}</div>
    ${fVencimiento ? '<div class="linea"><strong>FECHA DE VENCIMIENTO:</strong> ' + this._escapeHtml(fVencimiento) + '</div>' : ''}
    ${htmlDocMotivoNcNd}
  </div>
  <table class="detalle">
    <thead><tr>${incluirUnidadMedida
    ? '<th class="text-center" style="width:8%;">Cant.</th><th class="text-center" style="width:12%;">U. Medida</th><th style="width:36%;">Descripción</th><th class="text-end" style="width:16%;">P. Unit. (S/)</th><th class="text-end" style="width:16%;">Importe (S/)</th>'
    : '<th class="text-center" style="width:10%;">Cant.</th><th style="width:44%;">Descripción</th><th class="text-end" style="width:18%;">P. Unit. (S/)</th><th class="text-end" style="width:18%;">Importe (S/)</th>'}</tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="post-detalle-row">
    <div class="post-detalle-izq">
      <div class="son-bajo-total"><strong>SON:</strong> ${cantidadLetras || ''}</div>
      ${pieSunatHtml ? `<div class="pie-bajo-son">${pieSunatHtml}</div>` : ''}
    </div>
    <div class="post-detalle-der">
      <div class="totales-box">
        <table>${filasTotalesHtml}</table>
      </div>
    </div>
  </div>
  ${observaciones ? '<div class="observaciones" style="margin-top:12px;padding:8px;border:1px solid #eee;background:#fafafa;font-size:9px;"><strong>OBSERVACIONES:</strong><br>' + (observaciones || '').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>' : ''}
  ${mostrarFilaQrAuxiliares ? `<div class="fila-qr-auxiliares">
    <div class="qr-izq-col">${qrDataUri ? '<img src="' + qrDataUri + '" alt="QR"/>' : ''}</div>
    <div class="aux-der-col">${auxDerContenidoHtml}</div>
  </div>` : ''}
  <div class="bloque-final">
    ${barcodeIdVentaUrl ? '<div class="barcode-venta"><img src="' + barcodeIdVentaUrl + '" alt=""/></div>' : ''}
  </div>
</body>
</html>`;
  }
}

module.exports = new HtmlBuilderService();