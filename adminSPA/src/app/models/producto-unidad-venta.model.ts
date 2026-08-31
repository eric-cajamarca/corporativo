export interface ProductoUnidadVentaItem {
  idUnidadVenta: string;
  nombre: string;
  factorAInterna: number;
  precio: number | null;
  visibleEnPos?: boolean;
  orden?: number;
}

export interface ProductoUnidadConversion {
  idProducto?: string;
  unidadInternaNombre: string;
  factorCompraAInterna: number;
  activo?: boolean;
}

export interface ProductoUnidadesVentaResponse {
  conversion: ProductoUnidadConversion | null;
  unidades: ProductoUnidadVentaItem[];
  precioPrincipal?: number;
}

export interface ProductoUnidadesVentaGuardar {
  activo: boolean;
  unidadInternaNombre?: string;
  factorCompraAInterna?: number;
  unidades?: Array<{
    nombre: string;
    factorAInterna: number;
    precio?: number | null;
    visibleEnPos?: boolean;
    orden?: number;
  }>;
}
