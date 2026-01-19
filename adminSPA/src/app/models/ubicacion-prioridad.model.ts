export interface UbicacionPrioridad {
  idUbicacion?: number; // IDENTITY
  idSucursal: string;
  codigoUbicacion: string; // Ej: 'MOSTRADOR', 'ANDAMIO-5'
  prioridad: number; // 1=Primero, 2=Segundo...
}

export interface UbicacionPrioridadCreate {
  idSucursal: string;
  codigoUbicacion: string;
  prioridad: number;
}