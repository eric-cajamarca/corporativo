import { ComprobanteVAPdfData } from '../services/ventas.service';

/** Evita inyección HTML en el ticket desde datos de BD. */
export function escapeHtmlVa(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtN(n: number | undefined | null): string {
  const x = Number(n);
  if (Number.isNaN(x)) return '0.00';
  return x.toFixed(2);
}

/**
 * HTML único del comprobante Venta Agrupada: formato ticket (≈80mm), listo para imprimir.
 */
export function buildComprobanteVaTicketHtml(data: ComprobanteVAPdfData, idVentaAgrupada: string): string {
  const d = data;
  const tipoLabel = escapeHtmlVa(d.venta.tipoComprobanteDestinoNombre || d.venta.tipoComprobanteDestino || '');
  const comp = escapeHtmlVa(d.venta.compVenta || '—');
  const itemsHtml = (d.items || [])
    .map((it) => {
      const alias = escapeHtmlVa(it.aliasEmpresa || '');
      const desc = escapeHtmlVa(it.descripcion || it.codigo || 'Ítem');
      const cod = escapeHtmlVa(it.codigo || '');
      const suc = escapeHtmlVa(it.sucursal || '');
      const linea1 = alias ? `<span class="muted">${alias}</span> ` : '';
      const lineaSuc = suc ? `<div class="muted tiny">${suc}</div>` : '';
      const codPart = cod ? `<span class="muted tiny">${cod}</span> ` : '';
      return `<div class="item-block">
        <div class="item-desc">${linea1}${codPart}${desc}${lineaSuc}</div>
        <div class="item-qty">${fmtN(it.cantidad)} × ${fmtN(it.pVenta)}</div>
        <div class="item-tot">${fmtN(it.total)}</div>
      </div>`;
    })
    .join('');

  const logo = d.empresa?.logo ? escapeHtmlVa(d.empresa.logo) : '';
  const logoBlock = logo
    ? `<div class="logo-wrap"><img src="${logo}" alt="" class="logo-img" /></div>`
    : '';

  const sub = Number(d.venta.subtotal);
  const igv = Number(d.venta.igv);
  const descImpRaw = (d.venta as { descuentosImpresion?: number }).descuentosImpresion;
  const desc =
    descImpRaw != null && String(descImpRaw).trim() !== ''
      ? Number(descImpRaw)
      : Number(d.venta.descuentos);
  const showSub = !Number.isNaN(sub) && sub > 0;
  const showIgv = !Number.isNaN(igv) && igv > 0;

  const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(idVentaAgrupada)}&code=Code128&translate-esc=true&dpi=96`;

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Ticket VA ${comp}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    margin: 0;
    padding: 12px;
    background: #e9ecef;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket {
    max-width: 80mm;
    margin: 0 auto;
    background: #fff;
    padding: 10px 12px 14px;
    box-shadow: 0 1px 6px rgba(0,0,0,.12);
  }
  .center { text-align: center; }
  .logo-wrap { margin-bottom: 6px; }
  .logo-img { max-height: 44px; max-width: 100%; object-fit: contain; }
  .empresa { font-weight: 700; font-size: 13px; line-height: 1.25; }
  .ruc { font-size: 11px; margin-top: 2px; }
  .dir { font-size: 9px; color: #444; margin-top: 4px; line-height: 1.2; }
  .divider {
    border: none;
    border-top: 1px dashed #222;
    margin: 8px 0;
  }
  .titulo-va {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .comp-num { font-size: 15px; font-weight: 800; margin: 4px 0; }
  .meta { font-size: 10px; color: #333; }
  .muted { color: #666; font-size: 9px; }
  .tiny { font-size: 8px; }
  .item-block {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-rows: auto auto;
    gap: 0 6px;
    font-size: 10px;
    padding: 4px 0;
    border-bottom: 1px dotted #ccc;
  }
  .item-desc { grid-column: 1 / -1; line-height: 1.25; }
  .item-qty { color: #555; font-size: 9px; }
  .item-tot { text-align: right; font-weight: 600; }
  .totales { margin-top: 8px; font-size: 11px; }
  .totales .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .total-final {
    font-size: 14px;
    font-weight: 800;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 2px solid #000;
  }
  .barcode { margin-top: 10px; text-align: center; }
  .barcode img { height: 48px; max-width: 100%; }
  .id-uuid { font-size: 8px; color: #666; margin-top: 6px; word-break: break-all; }
  .acciones {
    margin-top: 14px;
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .btn {
    cursor: pointer;
    border: none;
    border-radius: 6px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
  }
  .btn-print { background: #0d6efd; color: #fff; }
  .btn-close { background: #6c757d; color: #fff; }
  @media print {
    body { background: #fff; padding: 0; }
    .ticket { box-shadow: none; max-width: none; width: 80mm; }
    .no-print { display: none !important; }
    @page { size: 80mm auto; margin: 2mm; }
  }
</style>
</head><body>
  <div class="ticket">
    ${logoBlock}
    <div class="center empresa">${escapeHtmlVa(d.empresa?.nombre || 'Empresa')}</div>
    <div class="center ruc">RUC: ${escapeHtmlVa(d.empresa?.ruc || '')}</div>
    ${d.empresa?.direccion ? `<div class="center dir">${escapeHtmlVa(d.empresa.direccion)}</div>` : ''}
    <hr class="divider"/>
    <div class="center titulo-va">Venta agrupada (VA)</div>
    <div class="center comp-num">${comp}</div>
    <div class="center meta">Destino: <strong>${tipoLabel}</strong></div>
    <div class="center meta">${escapeHtmlVa(d.venta.fEmision || '')}</div>
    ${d.venta.sucursal ? `<div class="center meta tiny">Suc.: ${escapeHtmlVa(d.venta.sucursal)}</div>` : ''}
    <hr class="divider"/>
    <div class="meta"><strong>Cliente</strong></div>
    <div class="meta">${escapeHtmlVa(d.cliente?.rSocial || d.cliente?.razonSocial || '—')}</div>
    <div class="meta">${escapeHtmlVa(d.cliente?.ruc || '')}</div>
    ${d.cliente?.direccion ? `<div class="meta tiny">${escapeHtmlVa(d.cliente.direccion)}</div>` : ''}
    <hr class="divider"/>
    <div class="meta" style="margin-bottom:4px"><strong>Detalle</strong></div>
    ${itemsHtml}
    <div class="totales">
      ${showSub ? `<div class="row"><span>Subtotal</span><span>S/ ${fmtN(d.venta.subtotal)}</span></div>` : ''}
      ${showIgv ? `<div class="row"><span>IGV</span><span>S/ ${fmtN(d.venta.igv)}</span></div>` : ''}
      <div class="row"><span>Descuentos</span><span>S/ ${fmtN(desc)}</span></div>
      <div class="row total-final"><span>TOTAL</span><span>S/ ${fmtN(d.venta.total)}</span></div>
    </div>
    <div class="barcode">
      <img src="${barcodeUrl}" alt="" width="200" height="50"/>
    </div>
    <div class="center id-uuid">${escapeHtmlVa(idVentaAgrupada)}</div>
    ${d.venta.observaciones ? `<div class="meta tiny" style="margin-top:6px">${escapeHtmlVa(d.venta.observaciones)}</div>` : ''}
  </div>
  <div class="acciones no-print">
    <button type="button" class="btn btn-print" onclick="window.print()">Imprimir</button>
    <button type="button" class="btn btn-close" onclick="window.close()">Cerrar</button>
  </div>
</body></html>`;
}

/** Abre ventana solo con ticket VA (no PDF ni otros formatos). */
export function openComprobanteVaTicket(data: ComprobanteVAPdfData, idVentaAgrupada: string): boolean {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(buildComprobanteVaTicketHtml(data, idVentaAgrupada));
  w.document.close();
  return true;
}
