import { Component, OnInit, ViewChild, ElementRef, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { PreciosService } from '../../../services/precios.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { PermisosService } from '../../../services/permisos.service';
import { ProductoCreate } from '../../../models/producto.models';

declare var bootstrap: any;

/** Fila en la grilla de precios (respuesta de productos + edición local). */
export interface ProductoPreciosFila {
  idProducto: string;
  codigo?: string;
  sku?: string;
  descripcion: string;
  descripcionPres?: string;
  idCategoria: number;
  idMarca: number;
  /** Nombre de marca (lista de productos / precios). */
  marca?: string;
  idPresentacion: number;
  cUnitario: number | null;
  nuevoCUnitario: number;
  fProduccion?: string | null;
  fVencimiento?: string | null;
  tipoProducto?: string;
  nuevoPrecio: number | null;
  precioActual?: number;
  idPrecio?: string | null;
  fActualizacion?: string;
  tienePrecio?: boolean;
  precios?: Record<number, { precio: number; idPrecio?: string; fActualizacion?: string }>;
  /** Stock / fila operativa (Lotes); nombre de sucursal activa. */
  idSucursal?: string;
  sucursal?: string;
}

export type PaginaItemPrecios = number | 'ellipsis';

@Component({
  selector: 'app-create-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TopnavComponent, SidebarComponent],
  templateUrl: './create-precios.component.html',
  styleUrls: ['./create-precios.component.css']

})
export class CreatePreciosComponent implements OnInit {
  readonly LISTA_TODAS = '__TODAS__';
  @ViewChild('modalNuevaLista') modalNuevaLista!: ElementRef;

  private readonly permisosService = inject(PermisosService);

  // Datos
  listasPrecio: any[] = [];
  productos: ProductoPreciosFila[] = [];
  monedas: any[] = [];
  productosFiltrados: ProductoPreciosFila[] = [];
  sucursales: any[] = [];
  /** Columna sucursal solo si hay más de una sucursal activa en la empresa. */
  mostrarColumnaSucursal = false;

  /** Vecinos del número de página activo (0 = solo página actual entre extremos; más compacto). */
  readonly paginationDelta = 0;

  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.productosFiltrados.length;
  }
  get productosPaginated(): ProductoPreciosFila[] {
    const start = (this.page - 1) * this.pageSize;
    return this.productosFiltrados.slice(start, start + this.pageSize);
  }
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  /**
   * Páginas a mostrar con elipsis (sin listar todas las páginas).
   * Si hay pocas páginas, devuelve la secuencia completa.
   */
  paginasCompacta(): PaginaItemPrecios[] {
    const total = this.totalPaginas;
    const current = this.page;
    const delta = this.paginationDelta;

    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const range: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    const out: PaginaItemPrecios[] = [];
    let prev: number | undefined;
    for (const i of range) {
      if (prev !== undefined) {
        if (i - prev === 2) {
          out.push(prev + 1);
        } else if (i - prev > 1) {
          out.push('ellipsis');
        }
      }
      out.push(i);
      prev = i;
    }
    return out;
  }

  esEllipsis(item: PaginaItemPrecios): item is 'ellipsis' {
    return item === 'ellipsis';
  }

  desdePagina(): number {
    return (this.page - 1) * this.pageSize + 1;
  }
  hastaPagina(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }
  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
  }

  // Estado
  listaSeleccionadaId: number | string | null = null;
  listaSeleccionada: any = null;
  listaEditar: any = null;
  filtroBusqueda: string = '';
  simboloMoneda: string = 'S/.';
  
  // Formulario
  formListaPrecio: FormGroup;
  
  // Modal precios multi-lista (solo cuando la lista principal es TODAS)
  modal: any;
  mostrarModalPreciosTodas = false;
  productoModalTodas: ProductoPreciosFila | null = null;
  preciosTodasListas: Array<{ idLista: number; nombre: string; idMoneda: number; precio: number }> = [];

  
  constructor(
    private fb: FormBuilder,
    private preciosService: PreciosService,
    private _productosService : ProductoService,
    private _sucursalService: SucursalService,
    private _tablasSunatService: TablasSunatService,
    public sidebarState: SidebarStateService
  ) {
    this.formListaPrecio = this.fb.group({
      idLista: [null],
      idSucursal: [null],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      idMoneda: ['', Validators.required],
      principal: [false],
      conIgv: [true],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      activo: [true]
    });
  }

  ngOnInit(): void {
    this.permisosService.cargarPermisosUsuario().subscribe({ error: () => {} });
    this.cargarListasPrecio();
    this.cargarProductos();
    this.cargarSucursales();
    this.cargarMonedas();
  }

  /** SaaS plan demo: una sola lista (principal); no permitir crear otras listas nuevas. */
  bloquearNuevaListaDemo(): boolean {
    if (this.permisosService.deploymentMode() !== 'saas') {
      return false;
    }
    return (this.permisosService.planCodeEfectivo() || '').toLowerCase() === 'demo';
  }

  ngAfterViewInit(): void {
    if (this.modalNuevaLista) {
      this.modal = new bootstrap.Modal(this.modalNuevaLista.nativeElement);
    }
  }

  // Carga de datos
  cargarListasPrecio(): void {
    this.preciosService.listar_listas_precios_empresa().subscribe({
      next: (response) => {
        this.listasPrecio = response.data || [];
              },
      error: (error) => {
        console.error('Error al cargar listas de precios:', error);
      }
    });
  }

  cargarProductos(opciones?: { evitarCache?: boolean }): void {
    this._productosService.obtenerProductosTodos(opciones).subscribe({
      next: (response) => {
        const arr = Array.isArray(response.data) ? response.data : [];
        const raw = arr as unknown as ProductoPreciosFila[];
        this.productos = raw.map((p) => ({
          ...p,
          nuevoPrecio: p.nuevoPrecio ?? null,
          nuevoCUnitario:
            p.cUnitario != null && !Number.isNaN(Number(p.cUnitario)) ? Number(p.cUnitario) : 0
        }));
        this.productosFiltrados = [...this.productos];
        this.page = 1;
        const idLista = this.obtenerIdListaNumericoSeleccionado();
        if (idLista != null) {
          this.productos.forEach((producto) =>
            this.actualizarPrecioProducto(producto, idLista)
          );
        }
      },
      error: (error) => {
        console.error('Error al cargar productos:', error);
      }
    });
  }

  cargarSucursales(): void {
    this._sucursalService.obtener_sucursal_idempresa(false).subscribe({
      next: (response) => {
        this.sucursales = response.data || [];
        this.mostrarColumnaSucursal = Array.isArray(this.sucursales) && this.sucursales.length > 1;
      },
      error: (error) => {
        console.error('Error al cargar sucursales:', error);
        this.mostrarColumnaSucursal = false;
      }
    });
  }

  cargarMonedas(): void {
    this._tablasSunatService.obtener_moneda().subscribe({
      next: (response) => {
        this.monedas = response.data;
              },
      error: (error) => {
        console.error('Error al cargar monedas:', error);
      }
    });
  }

  // Eventos
  onListaSeleccionada(): void {
    if (this.listaSeleccionadaId === this.LISTA_TODAS) {
      this.listaSeleccionada = null;
      this.simboloMoneda = 'S/.';
      this.resetearPrecios();
      this.productos.forEach((p) => {
        p.nuevoPrecio = null;
      });
      return;
    }
    this.listaSeleccionada = this.listasPrecio.find(
      lista => lista.idLista == this.listaSeleccionadaId
    );
    
    if (this.listaSeleccionada) {
      const idLista = this.obtenerIdListaNumericoSeleccionado();
      if (idLista == null) return;
      // Actualizar símbolo de moneda
      this.simboloMoneda = this.listaSeleccionada.idMoneda === 2 ? '$' : 'S/.';
       // Actualizar precioActual en cada producto
      this.productos.forEach(producto => {
        this.actualizarPrecioProducto(producto, idLista);
      });
      // Cargar precios para esta lista
      this.cargarPreciosProductos();
    }
  }

  private obtenerIdListaNumericoSeleccionado(): number | null {
    if (this.listaSeleccionadaId == null || this.listaSeleccionadaId === this.LISTA_TODAS) {
      return null;
    }
    const n = Number(this.listaSeleccionadaId);
    return Number.isNaN(n) ? null : n;
  }
  
  // Método clave: Obtener precio de un producto para una lista específica
  actualizarPrecioProducto(producto: ProductoPreciosFila, idLista: number): void {
    // Buscar en el objeto precios
    const precioData = producto.precios && producto.precios[idLista];
    
    if (precioData) {
      // Existe precio para esta lista
      producto.precioActual = precioData.precio;
      producto.fActualizacion = precioData.fActualizacion;
      producto.idPrecio = precioData.idPrecio;
      producto.tienePrecio = true;
    } else {
      // No existe precio para esta lista
      producto.precioActual = 0.00;
      producto.idPrecio = null;
      producto.tienePrecio = false;
    }
    
    // Si no se ha editado, resetear nuevoPrecio
    if (producto.nuevoPrecio === undefined) {
      producto.nuevoPrecio = null;
    }
  }
  
  // Cuando se carga inicialmente
  
  
  resetearPrecios(): void {
    this.productos.forEach((producto) => {
      producto.precioActual = 0.00;
      producto.tienePrecio = false;
    });
  }








  /////////////////////////////////////////////////////////

  cargarPreciosProductos(): void {
    if (!this.listaSeleccionadaId) return;
    
    // Aquí cargarías los precios actuales para esta lista
    // this.preciosService.listar_precios_producto(this.listaSeleccionadaId).subscribe(...)
    
    // Por ahora, actualizamos los productos con sus precios
    this.productos.forEach((producto) => {
      producto.precioActual = producto.nuevoPrecio ?? producto.precioActual;
      producto.nuevoPrecio = null;
    });
  }

  abrirModalNuevaLista(lista?: any): void {
    if (!lista && this.bloquearNuevaListaDemo()) {
      return;
    }
    this.listaEditar = lista;
    
    if (lista) {
      // Editar lista existente
      this.formListaPrecio.patchValue({
        idLista: lista.idLista,
        idEmpresa: lista.idEmpresa,
        idSucursal: lista.idSucursal,
        nombre: lista.nombre,
        idMoneda: lista.idMoneda,
        principal: lista.principal,
        conIgv: lista.conIgv,
        fecha_inicio: lista.fecha_inicio,
        fecha_fin: lista.fecha_fin,
        activo: lista.activo
      });
    } else {
      // Nueva lista
      this.formListaPrecio.reset({
        principal: false,
        conIgv: true,
        activo: true
      });
    }
    
    this.modal.show();
  }

  editarListaSeleccionada(): void {
    if (this.listaSeleccionada) {
      this.abrirModalNuevaLista(this.listaSeleccionada);
    }
  }

  guardarListaPrecio(): void {
        if (this.formListaPrecio.invalid) return;
    
    const raw = this.formListaPrecio.value;
    const formData = {
      ...raw,
      idSucursal: raw.idSucursal === 'null' || raw.idSucursal === '' || raw.idSucursal === undefined ? null : raw.idSucursal
    };
        
    if (formData.idLista) {
      // Editar
            this.preciosService.editar_lista_precios(formData.idLista, formData).subscribe({
        next: (response) => {
          this.modal.hide();
          this.cargarListasPrecio();
          alert('Lista actualizada correctamente');
        },
        error: (error) => {
          console.error('Error al editar lista:', error);
          alert('Error al editar lista');
        }
      });
    } else {
      // Crear
            this.preciosService.crear_lista_precios(formData).subscribe({
        next: (response) => {
          this.modal.hide();
          this.cargarListasPrecio();
          alert('Lista creada correctamente');
        },
        error: (error) => {
          console.error('Error al crear lista:', error);
          alert('Error al crear lista');
        }
      });
    }
  }


  /** True si hay algo que persistir (precios de lista y/o costo unitario). */
  puedeGuardar(): boolean {
    if (this.productos.length === 0) {
      return false;
    }
    if (this.productos.some((p) => this.costoUnitarioCambio(p))) {
      return true;
    }
    if (this.listaSeleccionadaId === this.LISTA_TODAS) {
      return false;
    }
    if (!this.listaSeleccionadaId) {
      return false;
    }
    return this.productos.some(
      (p) => p.nuevoPrecio != null && p.nuevoPrecio !== p.precioActual
    );
  }

  guardarPrecios(): void {
    const productosConCambioPrecio = this.productos.filter(
      (producto) => producto.nuevoPrecio != null && producto.nuevoPrecio !== producto.precioActual
    );
    const costosACambiar = this.productos.filter((p) => this.costoUnitarioCambio(p));

    if (this.listaSeleccionadaId === this.LISTA_TODAS) {
      if (costosACambiar.length === 0) {
        alert(
          'Con "TODAS" seleccionada, haga clic en "N. Precio" de un producto para editar todas sus listas. Use "Guardar Precios" solo para cambios de costo unitario.'
        );
        return;
      }
      this.ejecutarGuardado([], costosACambiar);
      return;
    }

    const preciosAGuardar = productosConCambioPrecio.map((producto) => ({
      idLista: this.listaSeleccionadaId,
      idProducto: producto.idProducto,
      idPrecio: producto.idPrecio,
      precio: producto.nuevoPrecio,
      idMoneda: this.listaSeleccionada!.idMoneda,
      idUsuario: 'USUARIO_ACTUAL'
    }));

    if (preciosAGuardar.length > 0 && !this.listaSeleccionadaId) {
      alert('Selecciona una lista de precios para guardar los precios de lista');
      return;
    }

    if (preciosAGuardar.length === 0 && costosACambiar.length === 0) {
      alert('No hay cambios de precio ni de costo unitario para guardar');
      return;
    }

    this.ejecutarGuardado(preciosAGuardar, costosACambiar);
  }

  private ejecutarGuardado(preciosAGuardar: any[], costosACambiar: ProductoPreciosFila[]): void {
    const precios$ =
      preciosAGuardar.length > 0
        ? this.preciosService.creaer_precio_producto(preciosAGuardar)
        : of(null);

    const costos$ =
      costosACambiar.length > 0
        ? forkJoin(
            costosACambiar.map((p) =>
              this._productosService.actualizarProducto(
                p.idProducto,
                this.construirPayloadActualizarCosto(p)
              )
            )
          )
        : of(null);

    forkJoin({ precios: precios$, costos: costos$ }).subscribe({
      next: () => {
        const partes: string[] = [];
        if (preciosAGuardar.length) {
          partes.push(`${preciosAGuardar.length} precio(s)`);
        }
        if (costosACambiar.length) {
          partes.push(`${costosACambiar.length} costo(s) unitario(s)`);
        }
        alert(`Guardado correctamente: ${partes.join(' y ')}.`);
        this.cargarPreciosProductos();
        this.cargarProductos({ evitarCache: true });
      },
      error: (error) => {
        console.error('Error al guardar precios o costos:', error);
        alert(
          error?.error?.message ||
            'Error al guardar. Revise la consola o intente de nuevo.'
        );
      }
    });
  }

  abrirModalPreciosTodasPara(producto: ProductoPreciosFila): void {
    if (this.listaSeleccionadaId !== this.LISTA_TODAS) {
      return;
    }
    this.productoModalTodas = producto;
    const base = this.listasPrecio || [];
    this.preciosTodasListas = base.map((l: any) => {
      const idLista = Number(l.idLista);
      const precioData = producto.precios?.[idLista];
      const precioRaw = precioData?.precio != null ? Number(precioData.precio) : 0;
      return {
        idLista,
        nombre: String(l.nombre || 'Lista'),
        idMoneda: Number(l.idMoneda || 1),
        precio: Number.isNaN(precioRaw) ? 0 : precioRaw
      };
    });
    this.mostrarModalPreciosTodas = true;
  }

  cancelarModalPreciosTodas(): void {
    this.mostrarModalPreciosTodas = false;
    this.productoModalTodas = null;
  }

  confirmarModalPreciosTodas(): void {
    const prod = this.productoModalTodas;
    if (!prod) {
      this.mostrarModalPreciosTodas = false;
      return;
    }
    const preciosAGuardar: any[] = [];
    for (const l of this.preciosTodasListas) {
      const precio = Number(l.precio);
      const precioData = prod.precios?.[l.idLista];
      preciosAGuardar.push({
        idLista: l.idLista,
        idProducto: prod.idProducto,
        idPrecio: precioData?.idPrecio ?? null,
        precio: Number.isNaN(precio) || precio < 0 ? 0 : precio,
        idMoneda: l.idMoneda,
        idUsuario: 'USUARIO_ACTUAL'
      });
    }
    this.mostrarModalPreciosTodas = false;
    this.productoModalTodas = null;
    this.ejecutarGuardado(preciosAGuardar, []);
  }

  costoUnitarioCambio(p: ProductoPreciosFila): boolean {
    const nu = Number(p.nuevoCUnitario);
    const orig = Number(p.cUnitario ?? 0);
    if (Number.isNaN(nu) || nu < 0) {
      return false;
    }
    return Math.abs(nu - orig) > 1e-9;
  }

  private construirPayloadActualizarCosto(p: ProductoPreciosFila): ProductoCreate {
    return {
      Codigo: (p.codigo ?? p.sku ?? '').trim(),
      idCategoria: Number(p.idCategoria),
      idMarca: Number(p.idMarca),
      descripcion: p.descripcion,
      idPresentacion: Number(p.idPresentacion),
      cUnitario: Number(p.nuevoCUnitario),
      fProduccion: p.fProduccion || undefined,
      fVencimiento: p.fVencimiento || undefined,
      tipoProducto: p.tipoProducto === 'C' || p.tipoProducto === 'S' ? p.tipoProducto : 'S'
    };
  }

  // Funciones auxiliares
  filtrarProductos(): void {
    if (!this.filtroBusqueda.trim()) {
      this.productosFiltrados = [...this.productos];
      this.page = 1;
      return;
    }

    const termino = this.filtroBusqueda.toLowerCase();
    this.productosFiltrados = this.productos.filter(
      (producto) =>
        (producto.descripcion || '').toLowerCase().includes(termino) ||
        (producto.codigo || '').toLowerCase().includes(termino) ||
        (producto.sku || '').toLowerCase().includes(termino) ||
        (producto.marca || '').toLowerCase().includes(termino) ||
        (producto.sucursal || '').toLowerCase().includes(termino)
    );
    this.page = 1;
  }

  validarPrecio(producto: ProductoPreciosFila): void {
    if (producto.nuevoPrecio != null && producto.nuevoPrecio < 0) {
      producto.nuevoPrecio = 0;
    }
  }

  validarCUnitario(producto: ProductoPreciosFila): void {
    if (producto.nuevoCUnitario < 0 || Number.isNaN(Number(producto.nuevoCUnitario))) {
      producto.nuevoCUnitario = Number(producto.cUnitario ?? 0);
    }
  }

  restaurarPrecio(producto: ProductoPreciosFila): void {
    producto.nuevoPrecio = producto.precioActual ?? null;
  }

  restaurarCUnitario(producto: ProductoPreciosFila): void {
    producto.nuevoCUnitario =
      producto.cUnitario != null ? Number(producto.cUnitario) : 0;
  }

  calcularVariacion(producto: ProductoPreciosFila): string {
    if (!producto.precioActual || !producto.nuevoPrecio) return '0';
    const variacion = ((producto.nuevoPrecio - producto.precioActual) / producto.precioActual) * 100;
    return variacion.toFixed(2);
  }

  desactivarLista(idLista: number): void {
    if (confirm('¿Estás seguro de desactivar/eliminar esta lista de precios?')) {
      this.preciosService.desactivar_lista_precios(idLista).subscribe({
        next: (response) => {
          alert(response.message || 'Lista procesada correctamente');
          this.cargarListasPrecio();
          if (this.listaSeleccionadaId === idLista) {
            this.listaSeleccionadaId = null;
            this.listaSeleccionada = null;
          }
        },
        error: (error) => {
          console.error('Error al desactivar lista:', error);
          alert('Error al procesar la lista');
        }
      });
    }
  }
}