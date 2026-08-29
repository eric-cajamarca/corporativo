export interface AsistenteMensaje {
  role: 'user' | 'model';
  text: string;
}

export interface AsistenteChatRequest {
  mensaje: string;
  historial: AsistenteMensaje[];
  rutaActual: string;
  tituloPagina: string;
}

export interface AsistenteChatResponse {
  status: number;
  success: boolean;
  data?: { respuesta: string };
  message?: string;
}

export interface AsistenteEstadoResponse {
  status: number;
  success: boolean;
  data?: { configurado: boolean };
  message?: string;
}

export interface AsistenteEnlace {
  etiqueta: string;
  ruta: string;
}
