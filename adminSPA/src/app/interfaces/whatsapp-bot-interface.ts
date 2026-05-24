export interface WhatsappBotConfig {
  idEmpresa?: string;
  activoBot: boolean;
  /** Si false, el servicio Factiliza WHATSAPP BOT no esta habilitado para la empresa. */
  servicioAutorizado?: boolean;
  idListaPrecio?: string | null;
  mensajeBienvenida: string;
  mensajeNoRegistrado: string;
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
