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

      case 'factura': {
        const proveedor = datos.proveedor || {};
        const comprobante = datos.comprobante || {};
        const totales = datos.totales || {};
        const bloqueProveedor = datos.proveedor
          ? `
          <div class="bloque-datos bloque-proveedor">
            <h3 class="bloque-titulo">Datos del proveedor</h3>
            <table class="tabla-datos-inline">
              <tr><td><strong>Razón social:</strong></td><td>${proveedor.razonSocial || '—'}</td></tr>
              <tr><td><strong>RUC:</strong></td><td>${proveedor.ruc || '—'}</td></tr>
              <tr><td><strong>Dirección:</strong></td><td>${proveedor.direccion || '—'}</td></tr>
              <tr><td><strong>Teléfono:</strong></td><td>${proveedor.telefono || '—'}</td></tr>
            </table>
          </div>`
          : '';
        const bloqueComprobante = datos.comprobante
          ? `
          <div class="bloque-datos bloque-comprobante">
            <h3 class="bloque-titulo">Datos del comprobante</h3>
            <table class="tabla-datos-inline">
              <tr><td><strong>Tipo:</strong></td><td>${comprobante.tipo || '—'}</td></tr>
              <tr><td><strong>Número:</strong></td><td>${comprobante.numero || comprobante.serie + '-' + comprobante.numeroDoc || '—'}</td></tr>
              <tr><td><strong>Serie:</strong></td><td>${comprobante.serie || '—'}</td></tr>
              <tr><td><strong>Nº documento:</strong></td><td>${comprobante.numeroDoc || '—'}</td></tr>
              <tr><td><strong>Fecha emisión:</strong></td><td>${comprobante.fEmision || '—'}</td></tr>
              <tr><td><strong>Fecha vencimiento:</strong></td><td>${comprobante.fVencimiento || '—'}</td></tr>
            </table>
          </div>`
          : '';
        const bloqueTotales = (datos.totales && (totales.subTotal != null || totales.total != null))
          ? `
          <div class="bloque-totales">
            <table class="tabla-datos-inline">
              ${totales.subTotal != null ? `<tr><td><strong>Subtotal:</strong></td><td class="text-end">S/ ${Number(totales.subTotal).toFixed(2)}</td></tr>` : ''}
              ${totales.igv != null ? `<tr><td><strong>IGV:</strong></td><td class="text-end">S/ ${Number(totales.igv).toFixed(2)}</td></tr>` : ''}
              ${totales.total != null ? `<tr><td><strong>Total:</strong></td><td class="text-end">S/ ${Number(totales.total).toFixed(2)}</td></tr>` : ''}
            </table>
          </div>`
          : '';
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Comprobante de Compra',
          empresa: datos.empresa,
          contenidoAntesTabla: bloqueProveedor + bloqueComprobante,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas || [], datos.filas || []),
          contenidoAdicional: `
            ${bloqueTotales}
            <div class="resumen-digital">
              <strong>SON:</strong> ${datos.cantidadLetras || ''}
            </div>
            <div class="observaciones">
              <strong>Resumen:</strong><br>${datos.resumenDigital || ''}
            </div>
          `
        });
        break;
      }

      case 'lista-ventas':
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Lista de Ventas',
          empresa: datos.empresa,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas, datos.filas)
        });
        break;

      case 'reporte':
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Reporte',
          empresa: datos.empresa,
          tablaHtml: htmlBuilder.construirTablaHtml(datos.columnas || [], datos.filas || [])
        });
        break;

      case 'comprobante-venta': {
        // Asegurar objetos para evitar "Cannot read properties of undefined (reading 'attrs')" u otros en librerías
        const empresa = datos.empresa && typeof datos.empresa === 'object' ? datos.empresa : {};
        const venta = datos.venta && typeof datos.venta === 'object' ? datos.venta : {};
        const cliente = datos.cliente && typeof datos.cliente === 'object' ? datos.cliente : {};
        html = await htmlBuilder.construirHtmlComprobanteVenta({
          empresa,
          venta,
          cliente,
          items: Array.isArray(datos.items) ? datos.items : [],
          cantidadLetras: datos.cantidadLetras || '',
          formato: formatoPdf,
          esCotizacion: datos.esCotizacion === true
        });
        break;
      }

      case 'arqueo-caja': {
        const fc = (n) => (n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const emp = datos.empresa || {};
        const razonSocial = (emp.razon_Social || emp.nombre || '').replace(/Nombre Predeterminado/i, '').trim() || '';
        const ruc = emp.ruc || '';
        const headerLine = [razonSocial, ruc ? `RUC: ${ruc}` : ''].filter(Boolean).join(' | ');
        const filasConceptos = (datos.resumenConceptos || []).map((r) =>
          `<tr><td>${(r.concepto || '').replace(/</g, '&lt;')}</td><td class="text-end">${r.importe >= 0 ? '+' : ''}${fc(r.importe)}</td></tr>`
        ).join('');
        const filasIngresos = (datos.movimientosIngresos || []).map((m) =>
          `<tr><td>${(m.formaPago || '').replace(/</g, '&lt;')}</td><td class="text-end">${fc(m.importe)}</td></tr>`
        ).join('');
        const filasEgresos = (datos.movimientosEgresos || []).map((m) =>
          `<tr><td>${(m.formaPago || '').replace(/</g, '&lt;')}</td><td class="text-end">${fc(m.importe)}</td></tr>`
        ).join('');
        const rango = datos.fechaFinal ? `${datos.fecha || ''} - ${datos.fechaFinal}` : (datos.fecha || '');
        html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Arqueo de Caja</title>
<style>body{font-family:Arial,sans-serif;font-size:10px;margin:0;padding:20px;color:#333}
.header{border-bottom:2px solid #0056b3;padding-bottom:8px;margin-bottom:15px;font-size:11px;font-weight:bold}
h2{color:#0056b3;margin:20px 0 10px 0;font-size:14px}
.fecha-reporte{color:#666;margin-bottom:15px;font-size:9px;font-style:italic}
table{width:100%;border-collapse:collapse;margin-top:15px;font-size:9px}
th,td{border:1px solid #ccc;padding:6px;text-align:left}
th{background:#f2f2f2;font-weight:bold;text-align:center}
.text-end{text-align:right}
.bloque-totales{margin-top:15px;padding:10px;background:#e8f4fd;border:1px solid #0056b3}</style>
</head><body>
  <div class="header">${headerLine || 'Arqueo de Caja'}</div>
  <h2>Arqueo de Caja</h2>
  <div class="fecha-reporte">Período: ${rango} | Caja: ${datos.cajaNombre || 'Todas'}</div>
  <h3>Resumen por concepto</h3>
  <table><thead><tr><th>Concepto</th><th class="text-end">Importe</th></tr></thead><tbody>${filasConceptos}</tbody><tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${fc(datos.totalConceptos)}</strong></td></tr></tfoot></table>
  <h3>Movimientos de Ingresos</h3>
  <table><thead><tr><th>Forma Pago</th><th class="text-end">Importe</th></tr></thead><tbody>${filasIngresos}</tbody><tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${fc(datos.totalMovimientosIngresos)}</strong></td></tr></tfoot></table>
  <h3>Movimientos de Egresos</h3>
  <table><thead><tr><th>Forma Pago</th><th class="text-end">Importe</th></tr></thead><tbody>${filasEgresos}</tbody><tfoot><tr><td><strong>Total</strong></td><td class="text-end"><strong>${fc(datos.totalMovimientosEgresos)}</strong></td></tr></tfoot></table>
  <div class="bloque-totales"><strong>Efectivo disponible en caja:</strong> ${fc(datos.saldoEfectivoDisponible)}</div>
</body></html>`;
        break;
      }

      case 'comprobante-despacho': {
        const columnas = datos.columnas || ['Código', 'Descripción', 'Cantidad', 'Ubicación'];
        const filas = datos.filas || (datos.items || []).map(it => [
          it.codigo || it.productoCodigo || '—',
          it.descripcion || it.productoDescripcion || '—',
          it.cantidad ?? it.cantPendiente ?? '—',
          it.ubicaciones || it.ubicacion || '—'
        ]);
        const bloqueVenta = (datos.venta && datos.cliente)
          ? `
          <div class="bloque-datos bloque-comprobante">
            <h3 class="bloque-titulo">Comprobante y cliente</h3>
            <table class="tabla-datos-inline">
              <tr><td><strong>Comprobante:</strong></td><td>${datos.venta.compVenta || '—'}</td></tr>
              <tr><td><strong>Cliente:</strong></td><td>${datos.cliente.razonSocial || datos.cliente.rSocial || '—'}</td></tr>
              <tr><td><strong>RUC/DNI:</strong></td><td>${datos.cliente.ruc || '—'}</td></tr>
              <tr><td><strong>idVenta:</strong></td><td>${datos.venta.idVenta ?? '—'}</td></tr>
            </table>
          </div>`
          : '';
        html = htmlBuilder.construirHtmlReporte({
          titulo: datos.titulo || 'Comprobante de despacho',
          empresa: datos.empresa || {},
          contenidoAntesTabla: bloqueVenta,
          tablaHtml: htmlBuilder.construirTablaHtml(columnas, filas)
        });
        break;
      }

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
    const mensaje = error && typeof error.message === 'string' ? error.message : 'Error al generar el PDF';
    res.status(500).json({ error: mensaje });
  }
}

module.exports = { generatePdf };
