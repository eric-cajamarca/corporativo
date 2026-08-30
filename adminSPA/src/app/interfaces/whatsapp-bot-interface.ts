export interface WhatsappBotConfig {
  idEmpresa?: string;
  activoBot: boolean;
  /** Si false, el servicio Factiliza WHATSAPP BOT no esta habilitado para la empresa. */
  servicioAutorizado?: boolean;
  idListaPrecio?: string | null;
  mensajeBienvenida: string;
  mensajeNoRegistrado: string;
  fActualizacion?: string;
  /** Fase 3: typing, delay, burbujas y reacciones. */
  humanizar?: boolean;
  /** Fase 3: false = tuteo, true = trato de usted. */
  tonoFormal?: boolean;
  usarEmojis?: boolean;
  delayMaxMs?: number;
  mensajeDespedida?: string | null;
  /** Celular del vendedor que recibe alertas de escalamiento (solo digitos, ej. 51999999999). */
  numeroEscalamiento?: string | null;
  escalamientoActivo?: boolean;
  escalamientoTimeoutMin?: number;
  umbralNoEntiendoEscalar?: number;
  /** Imágenes de Yape / Plin / transferencia cargadas para el bot. */
  formasPagoImagenes?: {
    yape: boolean;
    plin: boolean;
    transferencia: boolean;
  };
}

/** Conversacion en handoff a humano (GET /escaladas). */
export interface WhatsappBotEscalada {
  telefonoCliente: string;
  motivo: string | null;
  numeroVendedor: string | null;
  fEscalado: string | null;
  expiraEn: string | null;
  fActualizacion?: string;
}

export interface WhatsappBotCatalogoStatus {
  total: number;
  ultimaSync: string | null;
}

export interface WhatsappBotSinonimo {
  idSinonimo: string;
  idEmpresa: string;
  terminoEntrada: string;
  terminoBusqueda: string;
  fActualizacion?: string;
}

export interface WhatsappBotLogEntry {
  idLog: string;
  direccion: 'in' | 'out';
  telefonoCliente: string;
  messageId?: string | null;
  texto: string;
  fRegistro: string;
}

export interface WhatsappBotApiResponse<T> {
  status: number;
  success: boolean;
  data: T;
  message?: string;
}
