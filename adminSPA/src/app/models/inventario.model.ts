export interface Lote {
  idLote?: string; // UUID generado por SQL Server
  idEmpresa: string;
  idProducto: string;
  idSucursal: string;
  numeroLote?: string;
  costoUnitario: number;
  cantidadIngresada: number;
  cantidadDisponible: number;
  activo?: boolean;
  fechaIngreso?: Date;
  // Propiedades extendidas para UI
  nombreProducto?: string;
  codigoProducto?: string;
  nombreSucursal?: string;
  aliasEmpresa?: string;
  ubicaciones?: any[];
}

export interface LoteCreate {
  idProducto: string;
  idSucursal: string;
  costoUnitario: number;
  cantidadIngresada: number;
}