export interface LoteUbicacion {
  idLote: string;
  idUbicacion: number;
  cantidad: number;
  // Propiedades extendidas
  codigoUbicacion?: string;
  prioridad?: number;
}

export interface LoteUbicacionCreate {
  idLote: string;
  idUbicacion: number;
  cantidad: number;
}