const htmlBuilder = require('./htmlBuilder.service');

function escapeHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtFechaReporte(iso) {
  if (!iso) return '';
  const p = String(iso).slice(0, 10).split('-');
  if (p.length !== 3) return iso;
  return `${p[2]}-${p[1]}-${p[0]}`;
}

function fmtNum(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x.toFixed(2) : '0.00';
}

function construirBloqueComprobante(comp) {
  const filas = (comp.lineas || [])
    .map(
      (ln) => `
      <tr>
        <td>${escapeHtml(ln.codigo)}</td>
        <td>${escapeHtml(ln.producto)}</td>
        <td class="text-end">${ln.cantidad}</td>
        <td class="text-end">${fmtNum(ln.precio)}</td>
        <td class="text-end">${fmtNum(ln.importe)}</td>
      </tr>`
    )
    .join('');

  return `
    <div class="bloque-comprobante-compra">
      <table class="tabla-cabecera-compra">
        <tr><td colspan="4"><strong>PROVEEDOR:</strong> ${escapeHtml(comp.proveedor)}</td><td class="text-end"><strong>${escapeHtml(comp.estado)}</strong></td></tr>
        <tr><td colspan="2"><strong>R.U.C.:</strong> ${escapeHtml(comp.ruc)}</td><td colspan="3" class="text-end"><strong>TOTAL DOCUMENTO S/.:</strong> ${fmtNum(comp.total)}</td></tr>
        <tr><td colspan="2"><strong>DOCUMENTO:</strong> ${escapeHtml(comp.documento)}</td><td colspan="3" class="text-end"><strong>FECHA:</strong> ${escapeHtml(comp.fecha)}</td></tr>
        <tr><td colspan="5"><strong>DESCUENTO S/.:</strong> ${fmtNum(comp.descuentos)}</td></tr>
      </table>
      <table class="detalle-factura">
        <thead>
          <tr>
            <th>Código</th>
            <th>Producto</th>
            <th class="text-end">Cantidad</th>
            <th class="text-end">Precio</th>
            <th class="text-end">Importe</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
        <tfoot>
          <tr><td colspan="4" class="text-end"><strong>SUB TOTAL:</strong></td><td class="text-end">${fmtNum(comp.subTotal)}</td></tr>
          <tr><td colspan="4" class="text-end"><strong>IGV:</strong></td><td class="text-end">${fmtNum(comp.igv)}</td></tr>
          <tr><td colspan="4" class="text-end"><strong>TOTAL:</strong></td><td class="text-end"><strong>${fmtNum(comp.total)}</strong></td></tr>
        </tfoot>
      </table>
    </div>`;
}

function construirHtmlComprasDetallado(datos) {
  const empresa = datos.empresa || {};
  const fechaInicio = datos.fechaInicio || '';
  const fechaFin = datos.fechaFin || '';
  const comprobantes = Array.isArray(datos.comprobantes) ? datos.comprobantes : [];
  const totales = datos.totales || {};

  const bloques = comprobantes.map((c) => construirBloqueComprobante(c)).join('');
  const sinDatos =
    comprobantes.length === 0
      ? '<p class="sin-datos">No hay compras registradas en el periodo seleccionado.</p>'
      : '';

  const resumenTotales =
    comprobantes.length > 0
      ? `
    <div class="resumen-periodo">
      <h3>Resumen del periodo</h3>
      <table class="tabla-datos-inline">
        <tr><td><strong>Comprobantes:</strong></td><td>${totales.cantidadComprobantes ?? comprobantes.length}</td></tr>
        <tr><td><strong>Sub total:</strong></td><td class="text-end">S/ ${fmtNum(totales.subTotal)}</td></tr>
        <tr><td><strong>IGV:</strong></td><td class="text-end">S/ ${fmtNum(totales.igv)}</td></tr>
        <tr><td><strong>Total:</strong></td><td class="text-end"><strong>S/ ${fmtNum(totales.total)}</strong></td></tr>
      </table>
    </div>`
      : '';

  const estilosExtra = `
    <style>
      .subtitulo-periodo { text-align: center; margin: 8px 0 16px; font-size: 12px; }
      .bloque-comprobante-compra { page-break-inside: avoid; margin-bottom: 24px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
      .tabla-cabecera-compra { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
      .tabla-cabecera-compra td { padding: 4px 6px; border: none; vertical-align: top; }
      .sin-datos { text-align: center; color: #666; padding: 24px; }
      .resumen-periodo { margin-top: 16px; padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; }
    </style>`;

  return htmlBuilder.construirHtmlReporte({
    titulo: 'REPORTE DE COMPRAS DETALLADO',
    empresa,
    contenidoAntesTabla: `
      ${estilosExtra}
      <p class="subtitulo-periodo">Periodo del ${escapeHtml(fmtFechaReporte(fechaInicio))} al ${escapeHtml(fmtFechaReporte(fechaFin))}</p>
      ${sinDatos}
      ${bloques}
      ${resumenTotales}
    `,
    tablaHtml: '',
  });
}

module.exports = { construirHtmlComprasDetallado };
