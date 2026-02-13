export interface Impuesto {
  idImpuesto: number;
  idEmpresa?: string;
  descripcion: string;
  estado: boolean;
  porcentaje: number;
  pIncluyeIGV: boolean;
  fCreacion?: string;
}

export interface ImpuestoCreate {
  descripcion: string;
  estado: boolean;
  porcentaje: number;
  pIncluyeIGV: boolean;
}
