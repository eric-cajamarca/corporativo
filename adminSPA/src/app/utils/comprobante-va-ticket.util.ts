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
export function buildComprobanteVaTicketHtml(data: ComprobanteVAPdfData): string {
  const d = data;
  const tipoLabel = escapeHtmlVa(d.venta.tipoComprobanteDestinoNombre || d.venta.tipoComprobanteDestino || '');
  const comp = escapeHtmlVa(d.venta.compVenta || '—');
  const nombreEmpresaTicket = escapeHtmlVa((d.empresa?.nombre || '').trim());
  const itemsHtml = (d.items || [])
    .map((it) => {
      const aliasRaw = String(it.aliasEmpresa || '').trim();
      const nombreLinea = escapeHtmlVa(aliasRaw || nombreEmpresaTicket || '—');
      const marcaRaw = String((it as { marca?: string }).marca || '').trim();
      const descBase = String(it.descripcion || it.codigo || 'Ítem').trim();
      const descConcat = marcaRaw && descBase ? `${descBase} - ${marcaRaw}` : descBase || marcaRaw || 'Ítem';
      const desc = escapeHtmlVa(descConcat);
      const cod = escapeHtmlVa(it.codigo || '');
      const sucRaw = String(it.sucursal || '').trim();
      const suc = escapeHtmlVa(sucRaw);
      const codPart = cod ? `<span class="ticket-secundario">${cod}</span> · ` : '';
      const parteSucursal = sucRaw
        ? `<span class="item-emp-suc-sep"> - </span><span class="ticket-secundario item-emp-suc-suc">${suc}</span>`
        : '';
      const celdaEmpresa = `<div class="item-emp-suc"><span class="item-emp-suc-nombre">${nombreLinea}</span>${parteSucursal}</div>`;
      return `<div class="item-block">
        <div class="item-desc">${codPart}${desc}</div>
        <div class="item-fila-precio">
          ${celdaEmpresa}
          <div class="item-qty">${fmtN(it.cantidad)} × ${fmtN(it.pVenta)}</div>
          <div class="item-tot">${fmtN(it.total)}</div>
        </div>
      </div>`;
    })
    .join('');

  const logoRaw = String(d.empresa?.logo || '').trim();
  const logoEsPlaceholder =
    !logoRaw ||
    /\/assets\/img\/01\.jpg$/i.test(logoRaw) ||
    /\/assets\/img\/01\.png$/i.test(logoRaw);
  const logo = !logoEsPlaceholder ? escapeHtmlVa(logoRaw) : '';
  const logoBlock = logo
    ? `<div class="logo-wrap"><img src="${logo}" alt="Logo gestora" class="logo-img" /></div>`
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

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Ticket VA ${comp}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 10px;
    margin: 0;
    padding: 12px;
    background: #e9ecef;
    color: #000000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket {
    max-width: 80mm;
    margin: 0 auto;
    background: #fff;
    padding: 10px 12px 14px;
    box-shadow: 0 1px 6px rgba(0,0,0,.12);
    color: #000000;
  }
  .center { text-align: center; }
  .logo-wrap { margin: 0 0 8px; padding: 0; }
  .logo-img { max-height: 96px; max-width: 68mm; width: auto; height: auto; object-fit: contain; }
  .empresa { font-weight: 700; font-size: 10px; line-height: 1.25; color: #000; }
  .ruc { font-size: 10px; margin-top: 2px; color: #000; }
  .dir { font-size: 10px; color: #000; margin-top: 4px; line-height: 1.2; }
  .divider {
    border: none;
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  .titulo-va {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: #000;
  }
  .comp-num { font-size: 12px; font-weight: 800; margin: 4px 0; color: #000; letter-spacing: 0.02em; }
  .meta { font-size: 10px; color: #000; }
  /**
   * Secundario: siempre negro (#000) para impresora B/N.
   * Jerarquía sin gris: tamaño 9px + cursiva + sangría/borde (el gris claro no se ve al imprimir).
   */
  .ticket-secundario {
    color: #000;
    font-size: 12px;
    font-weight: 400;
    font-style: italic;
    line-height: 1.2;
  }
  .item-block {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11.5px;
    padding: 2px 0;
    border-bottom: 1px dotted #000;
    color: #000;
  }
  .item-desc { line-height: 1.25; width: 100%; }
  .item-fila-precio {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: end;
    gap: 4px 6px;
    width: 100%;
  }
  .item-emp-suc {
    min-width: 0;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    color: #000;
  }
  .item-emp-suc-nombre { font-style: normal; }
  .item-emp-suc-sep { font-weight: 600; font-style: normal; }
  .item-emp-suc .ticket-secundario { display: inline; }
  .item-qty {
    color: #000;
    font-size: 12px;
    white-space: nowrap;
    text-align: right;
  }
  .item-tot {
    text-align: right;
    font-weight: 700;
    color: #000;
    font-size: 13px;
    white-space: nowrap;
  }
  .totales { margin-top: 8px; font-size: 10px; color: #000; }
  .totales .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .total-final {
    font-size: 18px;
    font-weight: 800;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 2px solid #000;
    color: #000;
  }
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
    body { background: #fff; padding: 0; color: #000 !important; }
    .ticket { box-shadow: none; max-width: none; width: 80mm; color: #000 !important; }
    .ticket-secundario, .meta, .empresa, .item-block, .item-desc, .item-fila-precio, .item-emp-suc, .item-qty, .item-tot {
      color: #000 !important;
    }
    .comp-num { font-size: 12px !important; }
    .total-final { font-size: 16px !important; }
    .logo-img { max-height: 96px !important; max-width: 68mm !important; }
    .no-print { display: none !important; }
    @page { size: 80mm auto; margin: 2mm; }
  }
</style>
</head><body>
  <div class="ticket">
    ${logoBlock ? `<div class="center">${logoBlock}</div>` : ''}
    <div class="center empresa">${escapeHtmlVa(d.empresa?.nombre || 'Empresa')}</div>
    <div class="center ruc">RUC: ${escapeHtmlVa(d.empresa?.ruc || '')}</div>
    ${d.empresa?.direccion ? `<div class="center dir">${escapeHtmlVa(d.empresa.direccion)}</div>` : ''}
    <hr class="divider"/>
    <div class="center titulo-va">Venta agrupada (VA)</div>
    <div class="center comp-num">${comp}</div>
    <div class="center meta">Destino: <strong>${tipoLabel}</strong></div>
    <div class="center meta">${escapeHtmlVa(d.venta.fEmision || '')}</div>
    <hr class="divider"/>
    <div class="meta"><strong>Cliente</strong></div>
    <div class="meta">${escapeHtmlVa(d.cliente?.rSocial || d.cliente?.razonSocial || '—')}</div>
    <div class="meta">${escapeHtmlVa(d.cliente?.ruc || '')}</div>
    ${d.cliente?.direccion ? `<div class="meta ticket-secundario">${escapeHtmlVa(d.cliente.direccion)}</div>` : ''}
    <hr class="divider"/>
    <div class="meta" style="margin-bottom:4px"><strong>Detalle</strong></div>
    ${itemsHtml}
    <div class="totales">
      ${showSub ? `<div class="row"><span>Subtotal</span><span>S/ ${fmtN(d.venta.subtotal)}</span></div>` : ''}
      ${showIgv ? `<div class="row"><span>IGV</span><span>S/ ${fmtN(d.venta.igv)}</span></div>` : ''}
      <div class="row"><span>Descuentos</span><span>S/ ${fmtN(desc)}</span></div>
      <div class="row total-final"><span>TOTAL</span><span>S/ ${fmtN(d.venta.total)}</span></div>
    </div>
    ${d.venta.observaciones ? `<div class="meta ticket-secundario" style="margin-top:6px">${escapeHtmlVa(d.venta.observaciones)}</div>` : ''}
  </div>
  <div class="acciones no-print">
    <button type="button" class="btn btn-print" onclick="window.print()">Imprimir</button>
    <button type="button" class="btn btn-close" onclick="window.close()">Cerrar</button>
  </div>
</body></html>`;
}

/** Extrae el nombre de archivo del logo desde URL /logos o /api/obtener_logo. */
function extractLogoFilename(logoUrl: string): string | null {
  const s = String(logoUrl || '').trim();
  if (!s || s.startsWith('data:')) return null;
  if (/\/assets\/img\/01\.(jpg|png)$/i.test(s)) return null;
  const m = s.match(/(?:\/logos\/|\/obtener_logo\/)([^/?#]+)$/i);
  if (m?.[1]) return decodeURIComponent(m[1]);
  if (/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|gif|webp)$/i.test(s)) return s;
  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el logo'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Descarga el logo por rutas proxied (/api/obtener_logo o /logos) y lo embebe como data URI
 * para que la ventana del ticket (about:blank) lo muestre e imprima sin depender de red.
 */
async function resolveLogoDataUrl(logoUrl: string | undefined | null): Promise<string> {
  const s = String(logoUrl || '').trim();
  if (!s) return '';
  if (s.startsWith('data:')) return s;
  if (/\/assets\/img\/01\.(jpg|png)$/i.test(s)) return '';

  const filename = extractLogoFilename(s);
  const candidates: string[] = [];
  if (filename) {
    candidates.push(`/api/obtener_logo/${encodeURIComponent(filename)}`);
    candidates.push(`/logos/${encodeURIComponent(filename)}`);
  }
  if (/^https?:\/\//i.test(s)) candidates.push(s);

  for (const url of candidates) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob || blob.size < 32) continue;
      const dataUrl = await blobToDataUrl(blob);
      if (dataUrl.startsWith('data:')) return dataUrl;
    } catch {
      /* probar siguiente candidato */
    }
  }
  return '';
}

/** Abre ventana solo con ticket VA (no PDF ni otros formatos). Embebe el logo de la gestora. */
export async function openComprobanteVaTicket(data: ComprobanteVAPdfData): Promise<boolean> {
  // Abrir en el mismo tick del clic para no perder el gesto (popup blocker).
  const w = window.open('', '_blank');
  if (!w) return false;
  try {
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ticket VA</title></head>' +
        '<body style="font-family:sans-serif;padding:16px;color:#333">Cargando ticket…</body></html>'
    );
    w.document.close();
  } catch {
    /* algunos navegadores restringen write inicial */
  }

  const logoData = await resolveLogoDataUrl(data?.empresa?.logo);
  const payload: ComprobanteVAPdfData = {
    ...data,
    empresa: {
      ...(data.empresa || { nombre: '' }),
      logo: logoData || undefined
    }
  };
  try {
    w.document.open();
    w.document.write(buildComprobanteVaTicketHtml(payload));
    w.document.close();
  } catch {
    w.close();
    return false;
  }
  return true;
}
