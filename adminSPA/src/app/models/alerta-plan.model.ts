export interface AlertaPlanUso {
  clave: string;
  etiqueta: string;
  usado: number;
  maximo: number;
  porcentaje: number;
  nivel: 'aviso' | 'critico';
}
