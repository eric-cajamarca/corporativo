export type LeadComercialEstado =
  | 'nuevo'
  | 'interesado'
  | 'llamada_pendiente'
  | 'contactado'
  | 'ganado'
  | 'perdido';

export interface LeadComercialRow {
  idLead: string;
  telefonoLog: string;
  digitosCelular: string | null;
  nombre: string | null;
  rubro: string | null;
  rubroLibre: string | null;
  necesidad: string | null;
  intencionCompra: string | null;
  encaja: string | null;
  mejorHorario: string | null;
  estado: LeadComercialEstado;
  quiereLlamada: number;
  ultimoMensaje: string | null;
  ofrecioDemo: number;
  fOfrecioDemo: string | null;
  idEmpresaRegistrada: string | null;
  fRegistroEmpresa: string | null;
  notaRevision: string | null;
  fRevision: string | null;
  fCreacion: string;
  fActualizacion: string;
}

export interface LeadComercialMetricas {
  desde: string;
  hasta: string;
  leads: number;
  ofrecioDemo: number;
  empresas: number;
  pctDemo: number;
}

export interface LeadComercialChatMsg {
  direccion: string;
  texto: string;
  fRegistro: string;
}

export interface LeadComercialChat {
  lead: LeadComercialRow;
  mensajes: LeadComercialChatMsg[];
}
