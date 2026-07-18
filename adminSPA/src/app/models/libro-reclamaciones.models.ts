export interface ProveedorLibroReclamaciones {
  razonSocial: string;
  ruc: string;
  domicilio: string;
  telefono: string;
  email: string;
}

export interface LibroReclamacionRegistroRequest {
  tipo: 'QUEJA' | 'RECLAMO';
  consumidorNombre: string;
  consumidorDocumentoTipo: string;
  consumidorDocumentoNumero: string;
  consumidorDomicilio: string;
  consumidorTelefono?: string | null;
  consumidorEmail: string;
  esMenor?: boolean;
  tutorNombre?: string | null;
  bienTipo: 'PRODUCTO' | 'SERVICIO';
  bienDescripcion: string;
  bienMonto?: number | null;
  detalle: string;
  pedidoConsumidor?: string | null;
  /** Honeypot anti-spam (debe ir vacío). */
  website?: string;
}

export interface LibroReclamacionRegistroResponse {
  idReclamacion: string;
  codigo: string;
  tipo: string;
  mensaje: string;
  proveedor: ProveedorLibroReclamaciones;
}

export interface LibroReclamacionListItem {
  idReclamacion: string;
  codigo: string;
  tipo: string;
  consumidorNombre: string;
  consumidorDocumentoTipo: string;
  consumidorDocumentoNumero: string;
  consumidorEmail: string;
  consumidorTelefono?: string | null;
  bienTipo: string;
  bienDescripcion: string;
  bienMonto?: number | null;
  detalle: string;
  pedidoConsumidor?: string | null;
  estado: string;
  fechaRegistro: string;
  fechaRespuesta?: string | null;
}

export interface LibroReclamacionDetalle extends LibroReclamacionListItem {
  consumidorDomicilio: string;
  esMenor: boolean;
  tutorNombre?: string | null;
  respuestaProveedor?: string | null;
  respondidoPor?: string | null;
}
