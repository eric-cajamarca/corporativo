export interface Envio {
  idEnvio: string;
  idVenta: string;
  idTipoEnvio: number;
  idTransportista?: string;
  fechaEnvio: string;
  fechaEntregaEstimada?: string;
  fechaEntregaReal?: string;
  costoEnvio: number;
  direccionEntrega: string;
  contactoEntrega: string;
  telefonoContacto: string;
  estado: 'AGENDADO' | 'EN_CAMINO' | 'ENTREGADO' | 'DEVUELTO' | 'CANCELADO';
  observaciones?: string;
  tipoEnvio?: string;
  transportista?: string;
  cliente?: string;
  venta?: string;
  historialEstados?: HistorialEstadoEnvio[];
}

export interface EstadoEnvio {
  idEstado: number;
  nombre: string;
  descripcion?: string;
  orden: number;
}

export interface TipoEnvio {
  idTipoEnvio: number;
  nombre: string;
  descripcion?: string;
  costoBase: number;
  tiempoEstimadoHoras: number;
}

export interface Transportista {
  idTransportista: string;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  vehiculo?: string;
  placa?: string;
  estado: boolean;
}

export interface HistorialEstadoEnvio {
  idHistorial: string;
  idEnvio: string;
  idEstadoAnterior: number;
  idEstadoNuevo: number;
  fechaCambio: string;
  idUsuario: string;
  observaciones?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  usuario?: string;
}