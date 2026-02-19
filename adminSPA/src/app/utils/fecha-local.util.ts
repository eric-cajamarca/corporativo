/**
 * Fecha en zona local (navegador) para evitar desfase por UTC al mostrar o enviar fechas.
 */

/** Devuelve la fecha de hoy en zona local como YYYY-MM-DD. */
export function getFechaHoyLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

/** Formatea un Date como YYYY-MM-DD en hora local. */
export function formatFechaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
