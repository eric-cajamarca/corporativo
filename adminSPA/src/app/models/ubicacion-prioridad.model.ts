export interface UbicacionPrioridad {
  idUbicacion?: number; // IDENTITY
  idSucursal: string;
  codigoUbicacion: string; // Ej: 'MOSTRADOR', 'ANDAMIO-5', 'Piso 1'
  prioridad: number; // 1=Primero, 2=Segundo...
  idUbicacionPadre?: number | null; // null = ubicación padre (ej. Piso), con valor = hija (ej. Andamio bajo ese piso)
}

export interface UbicacionPrioridadCreate {
  idSucursal: string;
  codigoUbicacion: string;
  prioridad: number;
  idUbicacionPadre?: number | null;
}