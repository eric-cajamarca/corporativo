export interface FormaPago {
  idFormaPago: number;
  descripcion: string;
  tipo: number;
  requiereReferencia: number;
  activo?: number;   // efectivo por defecto
  recibido?: number;
  vuelto?: number;
  referencia?: string;
}

