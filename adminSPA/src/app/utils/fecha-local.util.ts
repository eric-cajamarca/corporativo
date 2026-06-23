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

/**
 * Fecha de venta/comprobante para API: YYYY-MM-DD en hora local.
 * Evita toISOString() (UTC), que después de las 19:00 en Perú envía el día siguiente.
 */
export function fechaVentaParaApi(valor: string | null | undefined): string {
  const v = valor != null ? String(valor).trim() : '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return v;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  return getFechaHoyLocal();
}

/** Hora actual del navegador HH:mm:ss (zona del cajero / cliente). */
export function getHoraLocalAhora(): string {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}:${String(n.getSeconds()).padStart(2, '0')}`;
}

/**
 * fEmision para registrar venta: fecha del formulario + hora actual del navegador.
 * Así un cajero en Perú emite a las 20:00 aunque el servidor esté en otro huso horario.
 */
export function fechaEmisionVentaParaApi(fechaForm: string | null | undefined): string {
  return `${fechaVentaParaApi(fechaForm)}T${getHoraLocalAhora()}`;
}

/** Igual que fechaEmisionVentaParaApi, para reutilizar la misma marca de tiempo en detalle. */
export function fechaHoraVentaClienteAhora(): string {
  return `${getFechaHoyLocal()}T${getHoraLocalAhora()}`;
}

/** Alias genérico: fecha del formulario (o hoy) + hora actual del navegador. */
export function fechaHoraOperacionParaApi(fechaForm?: string | null): string {
  return fechaEmisionVentaParaApi(fechaForm);
}

/** Igual que fechaVentaParaApi pero permite null (p. ej. fVencimiento opcional). */
export function fechaVentaOpcionalParaApi(valor: string | null | undefined): string | null {
  const v = valor != null ? String(valor).trim() : '';
  if (!v) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return v;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    return v.slice(0, 10);
  }
  return null;
}

/** Hora actual del navegador para operaciones hotel (reservas, check-in, consumo). */
export function fechaHoraClienteAhora(): string {
  return fechaHoraVentaClienteAhora();
}

/**
 * Noches de estadía hotel: salida − entrada (días calendario).
 * Ej.: entrada 21/06, salida 23/06 → 2 noches.
 */
export function calcularNochesEstadia(fechaEntrada: string | null | undefined, fechaSalida: string | null | undefined): number {
  const e = fechaEntrada != null ? String(fechaEntrada).trim().slice(0, 10) : '';
  const s = fechaSalida != null ? String(fechaSalida).trim().slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return 0;
  }
  const dEntrada = new Date(`${e}T12:00:00`);
  const dSalida = new Date(`${s}T12:00:00`);
  const diff = Math.round((dSalida.getTime() - dEntrada.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}
