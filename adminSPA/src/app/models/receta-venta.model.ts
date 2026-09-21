export type CondicionVentaFarmacia = 'LIBRE' | 'RECETA' | 'RETENIDA' | 'ESPECIAL';

export interface RecetaVentaPayload {
  tipo: CondicionVentaFarmacia;
  pacienteNombre: string;
  pacienteDoc?: string;
  medicoNombre: string;
  cmp: string;
  numeroReceta: string;
  fechaReceta: string;
}

export interface LineaRecetaVenta {
  idProducto: string;
  descripcion: string;
  cantidad: number;
  condicionVenta?: string | null;
}
