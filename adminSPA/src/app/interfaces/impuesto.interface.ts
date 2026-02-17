export interface Impuesto {
  idImpuesto: number;
  idEmpresa?: string;
  descripcion: string;
  codigoSunat?: string;
  estado: boolean;
  porcentaje: number;
  pIncluyeIGV: boolean;
  fCreacion?: string;
}

export interface ImpuestoCreate {
  descripcion: string;
  codigoSunat?: string;
  estado: boolean;
  porcentaje: number;
  pIncluyeIGV: boolean;
}

/** Código Catálogo 05 SUNAT (tipos de tributos) */
export interface CodigoSunatImpuesto {
  codigo: string;
  descripcion: string;
}
