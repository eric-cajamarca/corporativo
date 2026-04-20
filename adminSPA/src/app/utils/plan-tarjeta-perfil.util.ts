/**
 * Alineado con SaasPlanFactiliza / niveles de menú en backend.
 */

export function nivelPlan(planCode: string | null | undefined): number {
  const p = (planCode || '').toLowerCase().trim();
  const orden: Record<string, number> = {
    demo: 1,
    emprendedor: 2,
    profesional: 3,
    empresarial: 4,
    enterprise: 5
  };
  return orden[p] ?? 0;
}

/** Consultas Factiliza placa/SOAT: desde plan profesional en SaaS; en enterprise todo. */
export function tarjetaPermiteConsultaPlacaSoat(
  deploymentMode: string | null | undefined,
  planCode: string | null | undefined
): boolean {
  if ((deploymentMode || '').toLowerCase() !== 'saas') {
    return true;
  }
  return nivelPlan(planCode) >= 3;
}

export function tarjetaMostrarArqueoDemoPlan(
  deploymentMode: string | null | undefined,
  planCode: string | null | undefined
): boolean {
  return (deploymentMode || '').toLowerCase() === 'saas' && (planCode || '').toLowerCase().trim() === 'demo';
}

export function puedeVerArqueoCaja(esAdmin: boolean, permisos: readonly string[]): boolean {
  return esAdmin || permisos.includes('VER_ARQUEO') || permisos.includes('VER_CAJA');
}
