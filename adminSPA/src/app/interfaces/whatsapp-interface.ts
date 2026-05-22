export interface WhatsappApiResponse {
  status: number;
  success: boolean;
  message: string;
}

export type WhatsappProveedor = 'baileys' | 'factiliza';

export type WhatsappEstadoSesion =
  | 'desconectado'
  | 'conectando'
  | 'qr_pendiente'
  | 'conectado'
  | 'reconectando'
  | 'error';

export interface WhatsappSessionData {
  proveedor: WhatsappProveedor | string;
  estadoSesion: WhatsappEstadoSesion | string;
  telefonoVinculado: string | null;
  qrDataUrl: string | null;
  mensaje?: string | null;
  lastError?: string | null;
}

export interface WhatsappSessionApiResponse {
  status: number;
  success: boolean;
  data?: WhatsappSessionData;
  message?: string;
}
