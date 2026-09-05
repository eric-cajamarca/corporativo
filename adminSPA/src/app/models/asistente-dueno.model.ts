export interface AsistenteMensaje {
  role: 'user' | 'model';
  text: string;
}

export type AsistenteCampoEstado = 'vacio' | 'lleno' | 'oculto';

export interface AsistenteFotoCampo {
  etiqueta: string;
  estado: AsistenteCampoEstado;
}

/** Resumen de UI para el asistente. Nunca lleva values ni secretos. */
export interface AsistenteFotoPantalla {
  ruta: string;
  pantalla: string;
  paso: string;
  modo: string;
  acciones: string[];
  campos: AsistenteFotoCampo[];
  faltantes: string[];
  listos: string[];
}

export interface AsistenteChatRequest {
  mensaje: string;
  historial: AsistenteMensaje[];
  rutaActual: string;
  tituloPagina: string;
  fotoPantalla?: AsistenteFotoPantalla;
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
  data?: { configurado: boolean; gemini?: boolean };
  message?: string;
}

export interface AsistenteEnlace {
  etiqueta: string;
  ruta: string;
}
