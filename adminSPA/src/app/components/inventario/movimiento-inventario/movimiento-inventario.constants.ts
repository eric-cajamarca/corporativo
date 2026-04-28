/** Código de comprobante sugerido según tipo de movimiento */
export const CODIGO_COMPROBANTE_POR_TIPO_MOVIMIENTO: Record<string, string> = {
  INVENTARIO_INICIAL: 'II',
  ENTRADA_VARIA: 'IN',
  REAJUSTE_POSITIVO: 'IN',
  REAJUSTE_NEGATIVO: 'SA',
  SALIDA_MERMA: 'SA',
  DEVOLUCION: 'IN',
  TRANSFERENCIA: 'TF'
};

export const TIPOS_MOVIMIENTO_INGRESO = [
  'INVENTARIO_INICIAL',
  'ENTRADA_VARIA',
  'REAJUSTE_POSITIVO',
  'DEVOLUCION'
] as const;

export const TIPOS_MOVIMIENTO_SALIDA = ['REAJUSTE_NEGATIVO', 'SALIDA_MERMA', 'TRANSFERENCIA'] as const;

export const CODIGOS_COMPROBANTE_INGRESO = ['II', 'IN', 'IV'] as const;
export const CODIGOS_COMPROBANTE_SALIDA = ['SA', 'TF'] as const;

export interface FilaDetalle {
  idProducto: string;
  codigo: string;
  descripcion: string;
  cantidad: number;
  costoUnitario: number;
  fechaVencimiento: string;
  numeroLote: string;
}
