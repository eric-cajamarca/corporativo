import { interpretarBooleanoConfig } from './config-valor-booleano.util';

export function parseLineaCredito(valor: unknown): number {
  if (valor == null || valor === '') return 0;
  const n = Number(valor);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Sujeto a crédito si el flag está activo o si ya tiene línea mayor a 0. */
export function parseSujetoCredito(sujetoCredito: unknown, lineaCredito?: unknown): boolean {
  const linea = parseLineaCredito(lineaCredito);
  if (linea > 0) return true;
  return interpretarBooleanoConfig(sujetoCredito, false);
}
