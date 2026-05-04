export interface Sucursal {
  idSucursal: string;
  nombre: string;
  direccion?: string;
  fechaRegistro?: string;
  fregistro?: string;
  esPrincipal?: boolean | number | string;
  /** Si no es null, correlativos desde la sucursal indicada. */
  idSucursalSeriesPadre?: string | null;
}

