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
  fCreacion: string;
  fActualizacion: string;
}
