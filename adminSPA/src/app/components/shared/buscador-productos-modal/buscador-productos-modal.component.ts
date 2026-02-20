import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { GestoresService } from '../../../services/gestores.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';

export interface ProductoSeleccionado {
  idProducto: string;
  codigo: string;
  descripcion: string;
  idPresentacion?: number;
  codigoPresentacion?: string;
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
  searchTerm = '';
  productosConst: ProductoSeleccionado[] = [];
  productosFiltrados: ProductoSeleccionado[] = [];
  loading = false;
  idSucursal: string | null = null;

  /** Galería: solo si está habilitado en configuración de inventario */
  productosConImagenes = false;
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
    private productosImagenService: ProductosImagenService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'buscador-productos-modal.component.ts:ngOnInit',message:'BuscadorProductosModalComponent ngOnInit',data:{},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const lista = Array.isArray(res?.data) ? res.data : [];
        // #region agent log
        const dataKeys = res?.data ? Object.keys(res.data as object).slice(0, 5) : [];
        const firstItemKeys = lista.length && typeof lista[0] === 'object' && lista[0] !== null ? Object.keys(lista[0] as object) : [];
        fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'buscador-productos-modal.component.ts:config next',message:'Config response',data:{listaLength:lista.length,isDataArray:Array.isArray(res?.data),dataKeys,firstItemKeys},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        const item = lista.find((c: { clave?: string; Clave?: string }) =>
          (c.clave || c.Clave || '') === 'PRODUCTOS_CON_IMAGENES'
        );
        const valor = item && (item as { valor?: string; Valor?: string }).valor !== undefined
          ? (item as { valor?: string; Valor?: string }).valor
          : (item as { valor?: string; Valor?: string }).Valor;
        this.productosConImagenes = valor ? String(valor).toLowerCase() === 'true' : false;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'buscador-productos-modal.component.ts:after set',message:'After set productosConImagenes',data:{productosConImagenes:this.productosConImagenes,itemFound:!!item,valor:String(valor)},timestamp:Date.now(),hypothesisId:'H1,H3'})}).catch(()=>{});
        // #endregion
        this.cdr.detectChanges();
        this.cargarProductos();
      },
      error: (err) => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'buscador-productos-modal.component.ts:config error',message:'Config request error',data:{err: String(err?.message || err)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
        // #endregion
        this.cdr.detectChanges();
        this.cargarProductos();
      }
    });
  }

  cargarProductos(): void {
    this.loading = true;
    this.productoService.obtenerProductosTodos().subscribe({
      next: (response: any) => {
        const data = response?.data ?? [];
        this.productosConst = Array.isArray(data) ? data : [];
        this.productosFiltrados = [...this.productosConst];
        this.loading = false;
        if (this.productosConImagenes && this.productosFiltrados.length > 0) {
          this.productosFiltrados.forEach((p) => this.cargarPrimeraImagenSiNecesario(p));
        }
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/c3150317-d333-42b3-b498-118180355ae2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'39a89e'},body:JSON.stringify({sessionId:'39a89e',location:'buscador-productos-modal.component.ts:cargarProductos next',message:'Products loaded',data:{loading:this.loading,productosConImagenes:this.productosConImagenes,productosCount:this.productosFiltrados.length},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
      },
      error: () => {
        this.productosConst = [];
        this.productosFiltrados = [];
        this.loading = false;
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

  buscarProductos(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (term === '') {
      this.productosFiltrados = [...this.productosConst];
      return;
    }
    this.productosFiltrados = this.productosConst.filter((item: any) => {
      const descripcion = (item.descripcion ?? '').toString().toLowerCase();
      const codigo = (item.codigo ?? '').toString().toLowerCase();
      const marca = (item.nombre ?? '').toString().toLowerCase();
      const categoria = (item.categoria ?? '').toString().toLowerCase();
      return (
        descripcion.includes(term) ||
        codigo.includes(term) ||
        marca.includes(term) ||
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
}
