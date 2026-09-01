/** Respaldo si el usuario pierde `?checkout=` (mismo valor que checkout y crear-empresa). */
export const LS_CHECKOUT_PENDIENTE = 'efaf_checkout_pendiente';

export function leerCheckoutPendienteLocal(): string {
  try {
    const raw = localStorage.getItem(LS_CHECKOUT_PENDIENTE);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { orderNumber?: string };
    return String(parsed?.orderNumber || '').trim();
  } catch {
    return '';
  }
}

/** Hay orden de plan o demo (query o localStorage). */
export function tieneCheckoutRegistro(checkoutQuery: string | null | undefined): boolean {
  if (String(checkoutQuery || '').trim()) return true;
  return Boolean(leerCheckoutPendienteLocal());
}
