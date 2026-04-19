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
}

export interface LimitesUsoSuscripcion {
  maxUsuarios: number;
  maxSucursales: number;
  usuariosActivos: number;
  sucursales: number;
  excedeUsuarios: boolean;
  excedeSucursales: boolean;
}

export interface MiEstadoSuscripcionResponse {
  deploymentMode: string;
  suscripcion: SuscripcionEmpresaRow | null;
  planCatalogo: PlanSuscripcionResumen | null;
  limitesUso: LimitesUsoSuscripcion | null;
}
