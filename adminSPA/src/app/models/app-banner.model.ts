/** Severidad visual de la cinta (Bootstrap-like). */
export type AppBannerSeverity = 'info' | 'warning' | 'danger' | 'success';

/**
 * Un aviso en la cinta bajo el navbar.
 * - `id`: estable (para trackear dismiss si no hay dismissKey).
 * - `dismissKey`: si existe, el cierre se guarda en sessionStorage hasta cerrar sesión/pestaña.
 */
export interface AppBannerItem {
  id: string;
  severity: AppBannerSeverity;
  message: string;
  link?: string | null;
  linkLabel?: string | null;
  dismissible?: boolean;
  dismissKey?: string | null;
}
