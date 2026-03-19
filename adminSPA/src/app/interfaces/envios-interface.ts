export interface Envio {
  idEnvio: string;
  idVenta: string;
  idTipoEnvio: number;
  idTransportista?: string;
  idChofer?: string;
  idVehiculoEntrega?: string;
  fechaEnvio: string;
  fechaEntregaEstimada?: string;
  fechaEntregaReal?: string;
  costoEnvio: number;
  direccionEntrega: string;
  contactoDestinatario?: string;
  telefonoDestinatario?: string;
  estado: 'AGENDADO' | 'EN_CAMINO' | 'ENTREGADO' | 'DEVUELTO' | 'NO_ENCONTRADO' | 'CANCELADO' | 'EN_PREPARACION';
  observaciones?: string;
  tipoEnvio?: string;
  transportista?: string;
  cliente?: string;
  comprobante?: string;
  placaVehiculo?: string;
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