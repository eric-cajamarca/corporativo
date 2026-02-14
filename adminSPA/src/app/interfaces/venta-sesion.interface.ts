/**
 * Estado de una venta en curso para persistir en localStorage.
 * No se guarda idEmpresa; se obtiene del backend (token) al registrar.
 */
export interface VentaSesion {
  id: string;
  nombre: string;
  fechaCreacion: string;
  fechaActualizacion: string;
  carrito: any[];
  ventas: any;
  detallePago: any[];
  cliente: any;
  pagaCon: number;
  vuelto: number;
}

export interface VentasProvisionalStorage {
  sesiones: VentaSesion[];
  ultimaActualizacion: string;
}
