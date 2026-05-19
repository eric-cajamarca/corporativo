import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { GestoresService } from '../../../services/gestores.service';
import { EmpresaService } from '../../../services/empresa.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import { marcaProductoEnLista, productoSinStockEnBusqueda } from '../../../utils/producto-busqueda.util';
import { descripcionUnidadMedidaProducto } from '../../../utils/producto-presentacion.util';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';
import { StockUbicacionProductoFila } from '../../../models/producto.models';

export interface ProductoSeleccionado {
  idProducto: string;
  codigo: string;
  descripcion: string;
  marca?: string;
  nombreMarca?: string;
  idPresentacion?: number;
  codigoPresentacion?: string;
  descripcionPres?: string;
  pVenta: number;
  categoria?: string;
  sucursal?: string;
  stock?: number;
  idSucursal?: string | number;
  [key: string]: unknown;
}

@Component({
  selector: 'app-buscador-productos-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador-productos-modal.component.html',
  styleUrl: './buscador-productos-modal.component.css'
})
export class BuscadorProductosModalComponent implements OnInit {
  @ViewChild('inputBuscar') inputBuscar?: ElementRef<HTMLInputElement>;

  searchTerm = '';
  productosConst: ProductoSeleccionado[] = [];
  productosFiltrados: ProductoSeleccionado[] = [];
  loading = false;
  idSucursal: string | null = null;

  /** Galería: solo si está habilitado en configuración de inventario */
  productosConImagenes = false;
  /** Opción en Ventas: ver stock por ubicación en este modal */
  mostrarStockUbicacionesEnBuscador = false;
  /** Desde estado configuración: empresa gestora → mostrar columna Ubic. aunque la config ventas esté en false */
  esEmpresaGestoraPorEstado = false;
  modalStockUbicacionesAbierto = false;
  stockUbCargando = false;
  stockUbFilas: StockUbicacionProductoFila[] = [];
  stockUbProductoDesc = '';
  /** Imágenes del producto cuya galería se está viendo */
  imagenesProductoActual: ImagenProducto[] = [];
  visorAbierto = false;
  visorIndex = 0;
  /** idProducto del que se están cargando imágenes (para mostrar spinner solo en esa fila) */
  idProductoCargandoImagenes: string | null = null;
  /** Cache: idProducto -> URL de la primera imagen, o null si no tiene imágenes */
  imagenPrincipalPorProducto: Record<string, string | null> = {};
  /** IDs para los que ya pedimos la primera imagen (evitar doble petición) */
  private idsSolicitadosImagen = new Set<string>();
  /** URL por defecto cuando el producto no tiene imagen (placeholder) */
  readonly imagenPorDefecto = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>');

  constructor(
    public activeModal: NgbActiveModal,
    private productoService: ProductoService,
    private gestoresService: GestoresService,
    private empresaService: EmpresaService,
    private productosImagenService: ProductosImagenService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Cargar productos de inmediato para que el modal muestre datos aunque la config tarde o falle
    this.cargarProductos();
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res) => {
        this.esEmpresaGestoraPorEstado = !!(res?.data?.esGestora);
        this.cdr.detectChanges();
      },
      error: () => {}
    });
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.data) ? res.data : [];
        const normClave = (c: { clave?: string; Clave?: string }) =>
          String(c?.clave ?? c?.Clave ?? '')
            .trim()
            .toUpperCase();
        const item = lista.find((c: { clave?: string; Clave?: string }) => normClave(c) === 'PRODUCTOS_CON_IMAGENES');
        const valor = item && (item as { valor?: string; Valor?: string }).valor !== undefined
          ? (item as { valor?: string; Valor?: string }).valor
          : (item as { valor?: string; Valor?: string }).Valor;
        this.productosConImagenes = interpretarBooleanoConfig(valor, false);
        const itemUb = lista.find(
          (c: { clave?: string; Clave?: string }) => normClave(c) === 'VENTAS_MOSTRAR_STOCK_UBICACIONES_EN_BUSCADOR'
        );
        const valUb =
          itemUb && (itemUb as { valor?: string; Valor?: string }).valor !== undefined
            ? (itemUb as { valor?: string; Valor?: string }).valor
            : (itemUb as { valor?: string; Valor?: string })?.Valor;
        this.mostrarStockUbicacionesEnBuscador = interpretarBooleanoConfig(valUb, false);
        this.cdr.detectChanges();
        if (this.productosConImagenes && this.productosFiltrados.length > 0) {
          this.productosFiltrados.forEach((p) => this.cargarPrimeraImagenSiNecesario(p));
        }
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  cargarProductos(opciones?: { evitarCache?: boolean }): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.productoService.obtenerProductosTodos(opciones).subscribe({
      next: (response: any) => {
        const raw = response?.data;
        let data: any[] = [];
        if (Array.isArray(raw)) {
          data = raw;
        } else if (raw != null && typeof raw === 'object') {
          if (raw.idProducto != null) data = [raw];
          else if (Array.isArray(raw.productos)) data = raw.productos;
          else if (Array.isArray(raw.items)) data = raw.items;
          else if (Array.isArray(raw.data)) data = raw.data;
        }
        this.productosConst = data;
        this.loading = false;
        this.cdr.detectChanges();
        this.buscarProductos();
      },
      error: () => {
        this.productosConst = [];
        this.productosFiltrados = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Carga la primera imagen del producto para la miniatura (solo si no está ya cargada). */
  cargarPrimeraImagenSiNecesario(p: ProductoSeleccionado): void {
    const id = p?.idProducto;
    if (!id || this.imagenPrincipalPorProducto[id] !== undefined || this.idsSolicitadosImagen.has(id)) return;
    this.idsSolicitadosImagen.add(id);
    this.productosImagenService.listar(id).subscribe({
      next: (res) => {
        const primera = (res.data ?? [])[0];
        this.imagenPrincipalPorProducto[id] = primera?.url ?? null;
        this.idsSolicitadosImagen.delete(id);
        this.cdr.detectChanges();
      },
      error: () => {
        this.imagenPrincipalPorProducto[id] = null;
        this.idsSolicitadosImagen.delete(id);
        this.cdr.detectChanges();
      }
    });
  }

  /** Devuelve la URL de la miniatura: imagen principal o placeholder. */
  getThumbUrl(p: ProductoSeleccionado): string {
    const id = p?.idProducto;
    if (!id) return this.imagenPorDefecto;
    const url = this.imagenPrincipalPorProducto[id];
    return typeof url === 'string' ? url : this.imagenPorDefecto;
  }

  /** True si el producto tiene al menos una imagen (ya cargada). */
  tieneImagen(p: ProductoSeleccionado): boolean {
    const id = p?.idProducto;
    return id ? this.imagenPrincipalPorProducto[id] === undefined ? false : this.imagenPrincipalPorProducto[id] !== null : false;
  }

  /** Si la miniatura falla al cargar, usar placeholder. */
  onThumbError(p: ProductoSeleccionado): void {
    const id = p?.idProducto;
    if (id) {
      this.imagenPrincipalPorProducto[id] = null;
      this.cdr.detectChanges();
    }
  }

  /** Texto de marca para columna (API: marca / nombreMarca). */
  uMedidaColumna(p: ProductoSeleccionado): string {
    return descripcionUnidadMedidaProducto(p as Record<string, unknown>);
  }

  marcaColumna(p: ProductoSeleccionado): string {
    const t = marcaProductoEnLista(p as Record<string, unknown>);
    return t || '—';
  }

  sinStockBusqueda(p: ProductoSeleccionado): boolean {
    return productoSinStockEnBusqueda(p as Record<string, unknown>);
  }

  /**
   * Vuelve a consultar el catálogo en el servidor y reaplica el filtro del input sin modificarlo.
   */
  recargarProductosDesdeServidor(): void {
    this.cargarProductos({ evitarCache: true });
  }

  buscarProductos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (term === '') {
      this.productosFiltrados = [...this.productosConst];
      return;
    }
    this.productosFiltrados = this.productosConst.filter((item: any) => {
      const descripcion = (item.descripcion ?? '').toString().toLowerCase();
      const codigo = (item.codigo ?? '').toString().toLowerCase();
      const marcaCol = marcaProductoEnLista(item).toLowerCase();
      const marcaLegacy = (item.nombre ?? '').toString().toLowerCase();
      const categoria = (item.categoria ?? '').toString().toLowerCase();
      return (
        descripcion.includes(term) ||
        codigo.includes(term) ||
        marcaCol.includes(term) ||
        marcaLegacy.includes(term) ||
        categoria.includes(term)
      );
    });
    if (this.productosConImagenes) {
      this.productosFiltrados.forEach((p) => this.cargarPrimeraImagenSiNecesario(p));
    }
  }

  seleccionar(p: ProductoSeleccionado): void {
    this.activeModal.close(p);
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

  /**
   * Enfoca el campo de búsqueda tras abrir el modal (invocado desde el servicio al emitirse `shown`).
   * NgbModal suele enfocar antes el primer control del encabezado (p. ej. cerrar); se reintenta unas veces.
   */
  enfocarCampoBusqueda(): void {
    const el = (): HTMLInputElement | null => {
      const ref = this.inputBuscar?.nativeElement;
      if (ref) return ref;
      if (typeof document === 'undefined') return null;
      const byId = document.getElementById('buscador-productos-modal-search');
      return byId instanceof HTMLInputElement ? byId : null;
    };

    const intentar = (ms: number) => {
      setTimeout(() => {
        const input = el();
        if (input) {
          input.focus({ preventScroll: true });
          if (input.value.length > 0) {
            input.select();
          }
        }
      }, ms);
    };
    intentar(0);
    intentar(80);
    intentar(200);
  }

  verImagenes(p: ProductoSeleccionado, event: Event): void {
    event.stopPropagation();
    const idProducto = p.idProducto;
    if (!idProducto) return;
    this.idProductoCargandoImagenes = idProducto;
    this.visorAbierto = false;
    this.productosImagenService.listar(idProducto).subscribe({
      next: (res) => {
        this.imagenesProductoActual = res.data ?? [];
        this.idProductoCargandoImagenes = null;
        if (this.imagenesProductoActual.length > 0) {
          this.visorIndex = 0;
          this.visorAbierto = true;
        }
      },
      error: () => { this.idProductoCargandoImagenes = null; }
    });
  }

  cerrarVisor(): void {
    this.visorAbierto = false;
  }

  anteriorImagen(): void {
    if (this.imagenesProductoActual.length === 0) return;
    this.visorIndex = (this.visorIndex - 1 + this.imagenesProductoActual.length) % this.imagenesProductoActual.length;
  }

  siguienteImagen(): void {
    if (this.imagenesProductoActual.length === 0) return;
    this.visorIndex = (this.visorIndex + 1) % this.imagenesProductoActual.length;
  }

  puedeVerStockUbicaciones(p: ProductoSeleccionado): boolean {
    if (!this.mostrarColumnaUbicacionesBuscador()) {
      return false;
    }
    const sid = this.idSucursal ?? p.idSucursal;
    return sid != null && String(sid).trim() !== '';
  }

  /** Columna Ubic.: config VENTAS_MOSTRAR_STOCK_UBICACIONES_EN_BUSCADOR o empresa gestora. */
  mostrarColumnaUbicacionesBuscador(): boolean {
    return this.mostrarStockUbicacionesEnBuscador || this.esEmpresaGestoraPorEstado;
  }

  abrirStockUbicaciones(p: ProductoSeleccionado, ev: Event): void {
    ev.stopPropagation();
    const id = p?.idProducto;
    if (!id) {
      return;
    }
    const sidRaw = this.idSucursal ?? p.idSucursal;
    const idSucursal = sidRaw != null ? String(sidRaw).trim() : '';
    if (!idSucursal) {
      return;
    }
    this.stockUbProductoDesc = `${p.codigo} — ${p.descripcion}`;
    this.modalStockUbicacionesAbierto = true;
    this.stockUbCargando = true;
    this.stockUbFilas = [];
    this.cdr.detectChanges();
    this.productoService.obtenerStockUbicacionesProducto(id, idSucursal).subscribe({
      next: (res) => {
        this.stockUbFilas = Array.isArray(res?.data) ? res.data : [];
        this.stockUbCargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.stockUbFilas = [];
        this.stockUbCargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  cerrarStockUbicaciones(): void {
    this.modalStockUbicacionesAbierto = false;
    this.stockUbFilas = [];
    this.stockUbCargando = false;
  }

  /** Suma cantidades del modal (incluye fila «sin ubicación» si viene del API). */
  stockUbTotalCantidad(): number {
    if (!this.stockUbFilas?.length) {
      return 0;
    }
    return this.stockUbFilas.reduce((s, u) => s + (Number(u.cantidad) || 0), 0);
  }
}
