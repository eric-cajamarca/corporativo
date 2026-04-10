/** Formato físico del PDF de GRE (SUNAT). */
export type GrePdfFormato = 'A4' | 'ticket';

export function escapeHtmlGre(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Estilos inline compartidos (marcado tipo guías remisión / emisión).
 */
export function estilosGrePdfInline(formato: GrePdfFormato): string {
  if (formato === 'ticket') {
    return `*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:7px;color:#1a1a1a;padding:3mm;line-height:1.25;max-width:74mm}
.header{display:flex;flex-direction:column;align-items:stretch;gap:5px;border-bottom:1px solid #1d4ed8;padding-bottom:6px;margin-bottom:6px}
.empresa h2{font-size:10px;color:#1d4ed8;margin-bottom:2px}
.empresa p{font-size:7px;color:#555;line-height:1.35;word-break:break-word}
.doc-box{border:1px solid #1d4ed8;border-radius:4px;padding:5px 6px;text-align:center;width:100%}
.doc-box .tipo{font-size:7px;font-weight:700;color:#1d4ed8}
.doc-box .cod{font-size:6px;color:#666;margin:1px 0}
.doc-box .serie{font-size:12px;font-weight:900}
.doc-box .estado{margin-top:3px;font-size:6px}
table.info{width:100%;border-collapse:collapse;margin-bottom:6px}
table.info td{padding:2px 4px;border:1px solid #e5e7eb;font-size:6px;word-break:break-word;vertical-align:top}
table.info td:first-child,table.info td:nth-child(3){width:24%;background:#f1f5f9;font-weight:600;color:#374151}
.sec{background:#1d4ed8;color:#fff;font-size:7px;font-weight:700;padding:2px 6px;margin:6px 0 3px;border-radius:2px}
table.items{width:100%;border-collapse:collapse;font-size:6px;margin-bottom:6px}
table.items th{background:#1d4ed8;color:#fff;padding:2px 4px;text-align:left}
table.items td{padding:2px 4px;border-bottom:1px solid #e5e7eb;vertical-align:top}
.firma-box{margin-top:12px;display:flex;justify-content:space-around;text-align:center;font-size:6px;gap:4px}
.firma-box div{border-top:1px solid #374151;padding-top:3px;flex:1;min-width:0}`;
  }
  return `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:10px;color:#1a1a1a;padding:16px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:12px}
.empresa h2{font-size:13px;color:#1d4ed8;margin-bottom:4px}.empresa p{font-size:9px;color:#555;line-height:1.5}
.doc-box{border:2px solid #1d4ed8;border-radius:6px;padding:8px 14px;text-align:center;min-width:160px}
.doc-box .tipo{font-size:9px;font-weight:700;color:#1d4ed8}.doc-box .serie{font-size:16px;font-weight:900}
.doc-box .cod{font-size:7px;color:#666;margin:2px 0}
.doc-box .estado{margin-top:4px;font-size:9px}
table.info{width:100%;border-collapse:collapse;margin-bottom:10px}
table.info td{padding:3px 6px;border:1px solid #e5e7eb;font-size:9px}
table.info td:first-child,table.info td:nth-child(3){width:18%;background:#f1f5f9;font-weight:600;color:#374151}
.sec{background:#1d4ed8;color:#fff;font-size:9px;font-weight:700;padding:3px 8px;margin:8px 0 4px;border-radius:3px}
table.items{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:8px}
table.items th{background:#1d4ed8;color:#fff;padding:4px 6px;text-align:left}
table.items td{padding:3px 6px;border-bottom:1px solid #e5e7eb}
.firma-box{margin-top:28px;display:flex;justify-content:space-around;text-align:center;font-size:9px}
.firma-box div{border-top:1px solid #374151;padding-top:4px;min-width:140px}`;
}

/** Filas de ítems: ticket = 3 columnas; A4 = 5 columnas. */
export function greItemsTablaHtml(
  items: { codigo?: string; descripcion?: string; cantidad?: number | string; unidad?: string }[] | undefined,
  formato: GrePdfFormato
): string {
  const list = items ?? [];
  if (formato === 'ticket') {
    const rows =
      list.length > 0
        ? list
            .map((it, i) => {
              const desc = escapeHtmlGre(it.descripcion ?? '');
              const c = escapeHtmlGre(it.cantidad ?? '');
              const u = escapeHtmlGre(it.unidad ?? 'NIU');
              return `<tr><td>${i + 1}</td><td>${desc}</td><td>${c} ${u}</td></tr>`;
            })
            .join('')
        : `<tr><td colspan="3" style="text-align:center;color:#888">Sin bienes</td></tr>`;
    return `<table class="items"><thead><tr><th>#</th><th>Descripción</th><th>Cant.</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const rows =
    list.length > 0
      ? list
          .map((it, i) => {
            return `<tr><td>${i + 1}</td><td>${escapeHtmlGre(it.codigo ?? '')}</td><td>${escapeHtmlGre(it.descripcion ?? '')}</td><td>${escapeHtmlGre(it.cantidad ?? '')}</td><td>${escapeHtmlGre(it.unidad ?? 'NIU')}</td></tr>`;
          })
          .join('')
      : `<tr><td colspan="5" style="text-align:center;color:#888">Sin detalle de bienes</td></tr>`;
  return `<table class="items"><thead><tr><th>#</th><th>Código</th><th>Descripción</th><th>Cantidad</th><th>Unidad</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/** Bloque de firmas solo GRE transportista (recomendado en transporte). */
export function htmlFirmasGreTransportista(): string {
  return `<div class="firma-box"><div>Firma y sello emisor</div><div>Firma receptor conforme</div></div>`;
}
