/**
 * Alineado con SaasPlanFactiliza / niveles de menú en backend.
 */

import { NIVEL_MIN_PLACA_SOAT, nivelPlan } from '../config/saas-plan-reglas.util';

export { nivelPlan } from '../config/saas-plan-reglas.util';

/** Consultas Factiliza placa/SOAT: desde plan básico en SaaS; en enterprise todo. */
export function tarjetaPermiteConsultaPlacaSoat(
  deploymentMode: string | null | undefined,
  planCode: string | null | undefined
): boolean {
  if ((deploymentMode || '').toLowerCase() !== 'saas') {
    return true;
  }
  return nivelPlan(planCode) >= NIVEL_MIN_PLACA_SOAT;
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
