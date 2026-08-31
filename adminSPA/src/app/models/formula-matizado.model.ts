export interface FormulaMatizadoTinte {
  idProductoTinte: string;
  codigo?: string | null;
  descripcion?: string | null;
  gramosPorGalon: number;
}

export interface FormulaMatizado {
  idFormula: string;
  nombre: string;
  marcaVehiculo?: string | null;
  modeloVehiculo?: string | null;
  placa?: string | null;
  idProductoBase?: string | null;
  productoBase?: string | null;
  notas?: string | null;
  fCreacion?: string | null;
  tintes?: FormulaMatizadoTinte[];
}

export interface MatizadoTinteLinea {
  idProductoTinte: string;
  codigo?: string;
  descripcion?: string;
  gramos: number;
}

export interface MatizadoLineaPayload {
  nombreColor?: string;
  marcaVehiculo?: string;
  modeloVehiculo?: string;
  placa?: string;
  idFormula?: string;
  guardarFormula?: boolean;
  cargoMatizado?: number;
  factorEscala?: number;
  tintes: MatizadoTinteLinea[];
}
