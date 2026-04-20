/**
 * Nivel ordinal del plan (cotizaciones en demo, etc.). Caja demo se trata aparte en `saasPlanAcceso.service.js`.
 */
export function nivelPlan(planCode: string | null | undefined): number {
  const p = (planCode || '').toLowerCase();
  const orden: Record<string, number> = {
    demo: 1,
    emprendedor: 2,
    profesional: 3,
    empresarial: 4,
    enterprise: 5
  };
  return orden[p] ?? 2;
}

/** Ruta normalizada sin query, con prefijo `/`. */
export function normalizarRutaAbsoluta(url: string): string {
  const path = url.split('?')[0] || '/';
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}
