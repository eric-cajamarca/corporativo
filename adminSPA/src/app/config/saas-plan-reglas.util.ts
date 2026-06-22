/**
 * Nivel ordinal del plan (cotizaciones, compras SUNAT, placa/SOAT, etc.).
 * Caja demo se trata aparte en `saasPlanAcceso.service.js`.
 */
export function nivelPlan(planCode: string | null | undefined): number {
  const p = (planCode || '').toLowerCase();
  const orden: Record<string, number> = {
    demo: 1,
    basico: 2,
    emprendedor: 3,
    profesional: 4,
    empresarial: 5,
    enterprise: 6
  };
  return orden[p] ?? 2;
}

/** Mínimo plan Básico para WhatsApp vinculado (envío manual ilimitado). */
export const NIVEL_MIN_BASICO = 2;

/** Mínimo plan Emprendedor para bot de pedidos WhatsApp. */
export const NIVEL_MIN_EMPRENDEDOR = 3;

/** Mínimo plan Profesional para placa/SOAT en tarjeta de perfil (legacy UI). */
export const NIVEL_MIN_PROFESIONAL = 4;

export function planPermiteWhatsAppVinculado(planCode: string | null | undefined): boolean {
  return nivelPlan(planCode) >= NIVEL_MIN_BASICO;
}

export function planPermiteWhatsAppBot(planCode: string | null | undefined): boolean {
  return nivelPlan(planCode) >= NIVEL_MIN_EMPRENDEDOR;
}

/** Ruta normalizada sin query, con prefijo `/`. */
export function normalizarRutaAbsoluta(url: string): string {
  const path = url.split('?')[0] || '/';
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}
