import { ProductoSeleccionado } from '../components/shared/buscador-productos-modal/buscador-productos-modal.component';

export type BuscadorProductosModo = 'catalogo' | 'compra' | 'venta';

/** Opciones de búsqueda server-side / local usadas en ventas. */
export interface BuscadorProductosVentaOpciones {
  /** idSucursal enviado a buscar-venta (undefined = multi-sucursal / gestora). */
  idSucursalApi?: string;
  esGestora: boolean;
  /** Sucursal de la venta en curso (stock por ubicación). */
  idSucursalDefault?: string;
  /** Búsqueda instantánea sobre catálogo ya en memoria del padre. */
  buscarLocal?: (term: string) => ProductoSeleccionado[] | null;
  /** Filtra filas por empresa operativa (JWT). */
  filtrarFila?: (row: Record<string, unknown>) => boolean;
  /** Precarga catálogo en segundo plano al abrir el modal (gestora). */
  onPrecargarCatalogo?: () => void;
}

export interface BuscadorProductosModalOpciones {
  idSucursal?: string;
  modo?: BuscadorProductosModo;
  venta?: BuscadorProductosVentaOpciones;
  /** Etiqueta columna precio (p. ej. "Precio ref." en compras). */
  etiquetaPrecio?: string;
}
