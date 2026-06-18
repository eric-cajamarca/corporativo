import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { GestoresService } from '../../../services/gestores.service';
import { EmpresaService } from '../../../services/empresa.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import {
  marcaProductoEnLista,
  productoActivoParaVenta,
  productoCoincideBusquedaMultipalabra,
  productoSinStockEnBusqueda
} from '../../../utils/producto-busqueda.util';
import { descripcionUnidadMedidaProducto } from '../../../utils/producto-presentacion.util';
import { interpretarBooleanoConfig } from '../../../utils/config-valor-booleano.util';
import { StockUbicacionProductoFila } from '../../../models/producto.models';
import {
  BuscadorProductosModo,
  BuscadorProductosVentaOpciones
} from '../../../services/buscador-productos-modal.opciones';

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
  aliasEmpresa?: string;
  razonSocialEmpresa?: string;
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

  modo: BuscadorProductosModo = 'catalogo';
  ventaOpciones?: BuscadorProductosVentaOpciones;
  etiquetaPrecio = 'Precio';

  searchTerm = '';
  productosConst: ProductoSeleccionado[] = [];
  productosFiltrados: ProductoSeleccionado[] = [];
  loading = false;
  idSucursal: string | null = null;

  readonly buscadorMinCaracteres = 2;
  readonly buscadorLimiteFilas = 80;
  buscadorBuscando = false;
  buscadorMensaje = '';

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
  imagenesProductoActual: ImagenProducto[] = [];
  visorAbierto = false;
  visorIndex = 0;
  idProductoCargandoImagenes: string | null = null;
  imagenPrincipalPorProducto: Record<string, string | null> = {};
  private idsSolicitadosImagen = new Set<string>();
  /** Catálogo en memoria para filtrar al escribir (modo venta). */
  private catalogoVentaLocal: ProductoSeleccionado[] = [];

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
    if (this.modo === 'venta') {
      this.buscadorMensaje =
        `Escriba al menos ${this.buscadorMinCaracteres} caracteres. Al escribir filtra el catálogo en memoria; use Buscar para consultar la base de datos.`;
      this.cargarCatalogoVentaLocal();
    } else {
      this.cargarCatalogo();
    }

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

  private cargarCatalogo(opciones?: { evitarCache?: boolean }): void {
    if (this.modo === 'compra') {
      this.cargarProductosCompras(opciones);
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    this.productoService.obtenerProductosTodos(opciones).subscribe({
      next: (response: any) => {
        this.productosConst = this.normalizarListaProductos(response);
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

  private cargarProductosCompras(opciones?: { evitarCache?: boolean }): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.productoService.obtenerProductosCompras(opciones).subscribe({
      next: (response: any) => {
        this.productosConst = this.normalizarListaProductos(response);
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

  private normalizarListaProductos(response: any): ProductoSeleccionado[] {
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
    return data;
  }

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

  getThumbUrl(p: ProductoSeleccionado): string {
    const id = p?.idProducto;
    if (!id) return this.imagenPorDefecto;
    const url = this.imagenPrincipalPorProducto[id];
    return typeof url === 'string' ? url : this.imagenPorDefecto;
  }

  tieneImagen(p: ProductoSeleccionado): boolean {
    const id = p?.idProducto;
    return id ? this.imagenPrincipalPorProducto[id] === undefined ? false : this.imagenPrincipalPorProducto[id] !== null : false;
  }

  onThumbError(p: ProductoSeleccionado): void {
    const id = p?.idProducto;
    if (id) {
      this.imagenPrincipalPorProducto[id] = null;
      this.cdr.detectChanges();
    }
  }

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

  estaEnDetalleVenta(p: ProductoSeleccionado): boolean {
    const fn = this.ventaOpciones?.estaEnDetalle;
    return fn ? fn(p) : false;
  }

  muestraColumnaEmpresa(): boolean {
    if (this.modo === 'venta') {
      return !!this.ventaOpciones?.esGestora;
    }
    if (this.modo === 'compra') {
      return this.productosConst.some(
        (p) =>
          !!(p?.aliasEmpresa && String(p.aliasEmpresa).trim()) ||
          !!(p?.razonSocialEmpresa && String(p.razonSocialEmpresa).trim())
      );
    }
    return false;
  }

  textoSucursal(p: ProductoSeleccionado): string {
    if (this.modo === 'venta' && this.ventaOpciones?.esGestora) {
      const alias = p?.aliasEmpresa || '';
      const suc = p?.sucursal || '';
      return alias ? `${alias} - ${suc}` : suc;
    }
    return String(p?.sucursal ?? '');
  }

  trackByProducto(_index: number, p: ProductoSeleccionado): string {
    return `${p.idProducto || ''}|${p.idSucursal || ''}|${p['idEmpresa'] || ''}`;
  }

  recargarProductosDesdeServidor(): void {
    if (this.modo === 'venta') {
      const term = this.searchTerm.trim();
      if (term.length < this.buscadorMinCaracteres) {
        this.onBusquedaVentaInput();
        return;
      }
      this.ejecutarBusquedaVentaServidor(term, true);
      return;
    }
    this.cargarCatalogo({ evitarCache: true });
  }

  onBusquedaInput(): void {
    if (this.modo === 'venta') {
      this.onBusquedaVentaInput();
      return;
    }
    this.buscarProductos();
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

  private cargarCatalogoVentaLocal(): void {
    this.ventaOpciones?.onPrecargarCatalogo?.();
    this.productoService.obtenerProductosTodos().subscribe({
      next: (res) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        const activos = raw
          .filter((item) => productoActivoParaVenta(item as unknown as Record<string, unknown>))
          .map((item) => this.mapFilaVenta(item as unknown as Record<string, unknown>));
        this.catalogoVentaLocal = this.filtrarFilasVenta(activos);
        const term = this.searchTerm.trim();
        if (term.length >= this.buscadorMinCaracteres) {
          this.filtrarBusquedaVentaLocal(term);
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private filtrarBusquedaVentaLocal(term: string): void {
    const filtrados = this.catalogoVentaLocal
      .filter((item) =>
        productoCoincideBusquedaMultipalabra(item as Record<string, unknown>, term)
      )
      .slice(0, this.buscadorLimiteFilas);
    this.aplicarResultadosVenta(filtrados);
  }

  private fusionarCatalogoVentaLocal(filas: ProductoSeleccionado[]): void {
    if (!filas?.length) {
      return;
    }
    const clave = (r: ProductoSeleccionado) =>
      `${String(r.idProducto)}|${String(r.idSucursal || '')}|${String(r['idEmpresa'] || '')}`;
    const map = new Map<string, ProductoSeleccionado>();
    for (const r of this.catalogoVentaLocal) {
      map.set(clave(r), r);
    }
    for (const r of filas) {
      map.set(clave(r), r);
    }
    this.catalogoVentaLocal = [...map.values()];
  }

  private buscarVentaEnLocal(term: string): ProductoSeleccionado[] | null {
    if (this.ventaOpciones?.buscarLocal) {
      return this.ventaOpciones.buscarLocal(term);
    }
    return null;
  }

  private filasVentaActivasDesdeApi(filas: unknown[]): ProductoSeleccionado[] {
    return filas
      .filter((item) => productoActivoParaVenta(item as Record<string, unknown>))
      .map((item) => this.mapFilaVenta(item as Record<string, unknown>));
  }

  private mapFilaVenta(item: Record<string, unknown>): ProductoSeleccionado {
    return {
      ...item,
      idProducto: String(item['idProducto'] ?? ''),
      codigo: String(item['codigo'] ?? ''),
      descripcion: String(item['descripcion'] ?? ''),
      pVenta: Number(item['pVenta'] ?? 0)
    };
  }

  private filtrarFilasVenta(filas: ProductoSeleccionado[]): ProductoSeleccionado[] {
    const fn = this.ventaOpciones?.filtrarFila;
    if (!fn || !filas?.length) {
      return filas || [];
    }
    return filas.filter((row) => fn(row as Record<string, unknown>));
  }

  private aplicarResultadosVenta(activos: ProductoSeleccionado[]): void {
    const filtrados = this.filtrarFilasVenta(activos);
    this.productosFiltrados = filtrados;
    if (filtrados.length === 0) {
      this.buscadorMensaje = 'No se encontraron productos con ese criterio.';
    } else if (filtrados.length >= this.buscadorLimiteFilas) {
      this.buscadorMensaje = `Mostrando los primeros ${this.buscadorLimiteFilas} resultados. Refine la búsqueda si no ve el producto.`;
    } else {
      this.buscadorMensaje = '';
    }
    if (this.productosConImagenes) {
      filtrados.forEach((p) => this.cargarPrimeraImagenSiNecesario(p));
    }
    this.cdr.detectChanges();
  }

  onBusquedaVentaInput(): void {
    const term = this.searchTerm.trim();
    if (term.length < this.buscadorMinCaracteres) {
      this.productosFiltrados = [];
      this.buscadorBuscando = false;
      this.buscadorMensaje =
        term.length === 0
          ? `Escriba al menos ${this.buscadorMinCaracteres} caracteres. Al escribir filtra el catálogo en memoria; use Buscar para consultar la base de datos.`
          : `Escriba al menos ${this.buscadorMinCaracteres} caracteres.`;
      this.cdr.detectChanges();
      return;
    }
    const localParent = this.buscarVentaEnLocal(term);
    if (localParent !== null) {
      this.buscadorBuscando = false;
      this.aplicarResultadosVenta(localParent);
      return;
    }
    if (this.catalogoVentaLocal.length === 0) {
      this.productosFiltrados = [];
      this.buscadorBuscando = false;
      this.buscadorMensaje =
        'Catálogo en carga. Pulse Buscar para consultar la base de datos ahora.';
      this.cdr.detectChanges();
      return;
    }
    this.buscadorBuscando = false;
    this.buscadorMensaje = '';
    this.filtrarBusquedaVentaLocal(term);
  }

  private ejecutarBusquedaVentaServidor(term: string, evitarCache = false): void {
    this.buscadorBuscando = true;
    this.cdr.detectChanges();
    this.productoService
      .buscarProductosVenta({
        q: term,
        limit: this.buscadorLimiteFilas,
        idSucursal: this.ventaOpciones?.idSucursalApi,
        evitarCache
      })
      .subscribe({
        next: (response) => {
          this.buscadorBuscando = false;
          const filas = Array.isArray(response?.data) ? response.data : [];
          const activos = this.filasVentaActivasDesdeApi(filas);
          this.fusionarCatalogoVentaLocal(activos);
          this.aplicarResultadosVenta(activos);
        },
        error: (err) => {
          this.buscadorBuscando = false;
          this.productosFiltrados = [];
          this.buscadorMensaje = err?.error?.message || 'Error al buscar productos.';
          this.cdr.detectChanges();
        }
      });
  }

  seleccionar(p: ProductoSeleccionado): void {
    this.activeModal.close(p);
  }

  cerrar(): void {
    this.activeModal.dismiss();
  }

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
        this.cdr.detectChanges();
      },
      error: () => {
        this.idProductoCargandoImagenes = null;
        this.cdr.detectChanges();
      }
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

  idSucursalParaStockUb(p: ProductoSeleccionado | null | undefined): string {
    const fromProd = p?.idSucursal != null ? String(p.idSucursal).trim() : '';
    if (fromProd) {
      return fromProd;
    }
    const def = this.ventaOpciones?.idSucursalDefault ?? this.idSucursal;
    return def != null ? String(def).trim() : '';
  }

  puedeVerStockUbicaciones(p: ProductoSeleccionado): boolean {
    if (!this.mostrarColumnaUbicacionesBuscador()) {
      return false;
    }
    const sid = this.idSucursalParaStockUb(p);
    return sid.length > 0;
  }

  mostrarColumnaUbicacionesBuscador(): boolean {
    if (this.modo === 'venta') {
      return this.mostrarStockUbicacionesEnBuscador || !!this.ventaOpciones?.esGestora;
    }
    return this.mostrarStockUbicacionesEnBuscador || this.esEmpresaGestoraPorEstado;
  }

  abrirStockUbicaciones(p: ProductoSeleccionado, ev: Event): void {
    ev.stopPropagation();
    const id = p?.idProducto;
    if (!id) {
      return;
    }
    const idSucursal = this.idSucursalParaStockUb(p);
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

  stockUbTotalCantidad(): number {
    if (!this.stockUbFilas?.length) {
      return 0;
    }
    return this.stockUbFilas.reduce((s, u) => s + (Number(u.cantidad) || 0), 0);
  }
}
