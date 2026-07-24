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
  maxProductosActivos?: number;
  maxBotConversacionesSimultaneas?: number;
}

export interface PagoManualInfo {
  whatsappDisplay: string;
  whatsappE164: string;
  yapePlin: string;
  bcp: {
    titular: string | null;
    banco?: string | null;
    cuenta: string | null;
    cci: string | null;
    tipoCuenta?: string | null;
    moneda?: string | null;
  };
  /** Cuentas bancarias activas para depósito. */
  cuentas?: Array<{
    idCuentaBancaria: string;
    banco: string | null;
    cuenta: string | null;
    cci?: string | null;
    tipoCuenta: string | null;
    moneda: string;
    titular: string | null;
  }>;
  medios: string[];
  instruccionVoucher: string;
}

export interface CheckoutIniciado {
  orderNumber: string;
  montoSoles: number;
  montoCulqiCentimos: number;
  planCode: string;
  billingCycle: string;
  culqiPublicKey: string | null;
  culqiDisponible?: boolean;
  esDemo: boolean;
  pagoManual?: PagoManualInfo | null;
}

export interface CheckoutPagoManualReportado {
  orderNumber: string;
  estado: string;
  planCode: string;
  billingCycle: string;
  monto: number;
  medioPago?: string;
  pagoManual: PagoManualInfo;
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
