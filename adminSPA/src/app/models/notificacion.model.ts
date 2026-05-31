export type NotificacionTipo = 'warning' | 'success' | 'error' | 'info' | 'danger';

export interface NotificacionItem {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: NotificacionTipo;
  fecha: Date;
  leido: boolean;
  ruta?: string;
}
