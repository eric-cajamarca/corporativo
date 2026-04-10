import type { GuiaDetalle } from '../services/facturacion.service';

/** Mínimo ~2,5 cm a 96 dpi; impresión usa unidades físicas en el HTML del PDF. */
const QR_PDF_OPTIONS = {
  errorCorrectionLevel: 'M' as const,
  margin: 1,
  width: 280
};

/**
 * Genera data URL PNG para el QR de representación impresa SUNAT (GRE).
 */
export async function qrDataUrlDesdeCadenaSunat(cadena: string): Promise<string | null> {
  const c = cadena?.trim();
  if (!c) {
    return null;
  }
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(c, QR_PDF_OPTIONS);
  } catch {
    return null;
  }
}

export async function qrDataUrlParaPdfGuia(guia: GuiaDetalle): Promise<string | null> {
  const cadena = (guia.cadenaQrSunat ?? '').trim();
  return qrDataUrlDesdeCadenaSunat(cadena);
}

export interface HtmlBloqueQrGreOpciones {
  /** SUNAT: datos dentro del QR obligatorios; textos descriptivos alrededor no. Por defecto solo imagen (o reserva mínima). */
  soloDatoQr?: boolean;
  /** Ancho del código en impresión (representación impresa ≥ ~2,5 cm). */
  tamanoQr?: string;
}

/**
 * Bloque HTML del QR (representación impresa SUNAT).
 */
export function htmlBloqueQrSunatGre(qrDataUrl: string | null, opts?: HtmlBloqueQrGreOpciones): string {
  const solo = opts?.soloDatoQr !== false;
  const tam = opts?.tamanoQr ?? '2.6cm';
  if (!qrDataUrl) {
    if (solo) {
      return `<div style="margin-top:8px;height:${tam};min-height:22mm;border:1px dashed #d1d5db;box-sizing:border-box"></div>`;
    }
    return `<div style="margin-top:12px;padding:8px;border:1px dashed #d1d5db;border-radius:4px;text-align:center;font-size:8px;color:#9ca3af">
      Código QR SUNAT: no disponible (guía sin XML firmado o hash aún no generado). Conserve el XML/CDR para validación.
    </div>`;
  }
  if (solo) {
    return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;text-align:center">
    <img src="${qrDataUrl}" alt="" style="width:${tam};height:${tam};display:inline-block;image-rendering:pixelated" />
  </div>`;
  }
  return `<div style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="font-size:8px;font-weight:700;color:#374151;margin-bottom:6px">Representación impresa — Código QR (SUNAT)</p>
    <img src="${qrDataUrl}" alt="" style="width:${tam};height:${tam};display:inline-block;image-rendering:pixelated" />
    <p style="font-size:7px;color:#6b7280;margin-top:4px">Escanee para verificar el comprobante electrónico</p>
  </div>`;
}
