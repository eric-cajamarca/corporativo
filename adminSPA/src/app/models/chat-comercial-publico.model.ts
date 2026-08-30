export interface ChatComercialMensaje {
  role: 'user' | 'model';
  text: string;
  imagenUrl?: string | null;
}

export interface ChatComercialRespuesta {
  sessionId: string;
  respuesta: string;
  imagenUrl?: string | null;
  llamadaAgendada: boolean;
  avisoEnviado: boolean;
}
