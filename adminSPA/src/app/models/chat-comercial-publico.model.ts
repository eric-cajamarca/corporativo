export interface ChatComercialMensaje {
  role: 'user' | 'model';
  text: string;
  imagenUrl?: string | null;
}

export interface QuickChip {
  id: string;
  label: string;
  textToSend: string;
}

export interface EnlaceAccionChat {
  url: string;
  label: string;
}

export interface ChatComercialRespuesta {
  sessionId: string;
  respuesta: string;
  imagenUrl?: string | null;
  llamadaAgendada: boolean;
  avisoEnviado: boolean;
  chips?: QuickChip[];
}
