export interface PlanCatalogoItem {
  planCode: string;
  nombre: string;
  descripcionCorta: string;
  /** Beneficios mostrados como lista en la tarjeta del plan */
  beneficios: string[];
  precioMensualPen: number;
  precioAnualPen: number;
  maxUsuarios: number;
  maxSucursales: number;
  maxComprobantesSunatAceptados?: number;
}

export interface CheckoutIniciado {
  orderNumber: string;
  montoSoles: number;
  montoCulqiCentimos: number;
  planCode: string;
  billingCycle: string;
  culqiPublicKey: string | null;
  esDemo: boolean;
}

export interface DeploymentConfig {
  deploymentMode: 'saas' | 'enterprise';
  mostrarPlanesPublicos: boolean;
}

export interface SuscripcionEmpresaRow {
  idSuscripcion: string;
  idEmpresa: string;
  planCode: string;
  billingCycle: string | null;
  estado: string;
  fechaInicio: string;
  fechaFin: string | null;
  idCheckoutOrigen: string | null;
  migracionDemoPendiente: boolean;
  contadorComprobantesSunatAceptados?: number;
}
