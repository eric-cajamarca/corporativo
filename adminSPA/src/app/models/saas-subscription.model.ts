import { SuscripcionEmpresaRow } from './saas-public.model';

export interface PlanSuscripcionResumen {
  planCode: string;
  nombre: string;
  descripcionCorta: string;
  beneficios: string[];
  precioMensualPen: number;
  precioAnualPen: number;
  maxUsuarios: number;
  maxSucursales: number;
  /** 0 = sin límite de comprobantes SUNAT aceptados por plan. */
  maxComprobantesSunatAceptados?: number;
}

export interface LimitesUsoSuscripcion {
  maxUsuarios: number;
  maxSucursales: number;
  maxDireccionesEmpresa?: number;
  maxComprobantesSunatAceptados?: number;
  comprobantesSunatAceptados?: number;
  usuariosActivos: number;
  /** Plazas de usuario (incluye colaboradores pendientes de activación). */
  usuariosOcupados?: number;
  sucursales: number;
  direccionesEmpresa?: number;
  excedeUsuarios: boolean;
  excedeSucursales: boolean;
  excedeDirecciones?: boolean;
  excedeComprobantesSunat?: boolean;
  puedeCrearUsuario?: boolean;
  puedeCrearSucursal?: boolean;
  puedeAgregarDireccionEmpresa?: boolean;
  puedeCrearVentaPorCuotaSunat?: boolean;
}

/** Fila de SuscripcionCheckoutPendiente asociada a la empresa (cualquier plan: demo, emprendedor, etc.). */
export interface SuscripcionCheckoutOrdenResumen {
  orderNumber: string;
  planCode: string;
  billingCycle: string | null;
  monto: number;
  moneda: string;
  estado: string;
  fCreacion: string | null;
  fConfirmacion: string | null;
}

export interface MiEstadoSuscripcionResponse {
  deploymentMode: string;
  suscripcion: SuscripcionEmpresaRow | null;
  planCatalogo: PlanSuscripcionResumen | null;
  limitesUso: LimitesUsoSuscripcion | null;
  /** SaaS: historial de órdenes CHK-… vinculadas o de la suscripción actual. */
  checkoutsOrden?: SuscripcionCheckoutOrdenResumen[];
}
