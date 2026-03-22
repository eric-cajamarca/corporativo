import { Component, OnInit, Optional, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MarcaService } from '../../../services/marca.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { SucursalService } from '../../../services/sucursal.service';
import { GestoresService } from '../../../services/gestores.service';
import { ProductosImagenService, ImagenProducto } from '../../../services/productos-imagen.service';
import { ComprasService } from '../../../services/compras.service';
import { PreciosService } from '../../../services/precios.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;

interface Categoria {
  idCategoria: string;
  nombre: string;
}

interface Marca {
  idMarca: string;
  nombre: string;
}

interface Presentacion {
  idPresentacion: string;
  codigo: string;
  descripcion: string;
}

interface Sucursal {
  idSucursal: string;
  codigo: string;
  direccion: string;
}

@Component({
  selector: 'app-create-producto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    TopnavComponent,
    SidebarComponent,
  ],
  templateUrl: './create-producto.component.html',
  styleUrl: './create-producto.component.css'
})
export class CreateProductoComponent implements OnInit {
  // Formulario
  productoForm!: FormGroup;
  
  // Datos para selects
  categorias: Categoria[] = [];
  marcas: Marca[] = [];
  presentaciones: Presentacion[] = [];
  sucursales: Sucursal[] = [];
  listasPrecio: any[] = [];
  correlativo: { idCorrelativo?: string; numero?: number; [key: string]: unknown } = { numero: 0 };
  private codigoManual = '';

  // Estados
  guardando = signal<boolean>(false);
  cargandoDatos = signal<boolean>(true);
  
  // Tabs y modo
  activeTab = signal<string>('basico');
  modoLote = signal<boolean>(false);

  // Datos de lote
  loteData = {
    idSucursal: '',
    costoUnitario: 0,
    cantidadIngresada: 0,
    ubicacion: ''
  };

  // Precios
  precioVenta = 0;
  margenGanancia = 0;

  /** true cuando se abre como modal (desde ProductoCrearModalService) */
  esModal = false;

  /** Galería: activa si la empresa tiene productos con imágenes */
  productosConImagenes = false;
  /** Tras crear producto, id para subir imágenes */
  idProductoCreado: string | null = null;
  imagenesProducto: ImagenProducto[] = [];
  subiendoImagenes = false;
  archivosSeleccionados: File[] = [];

  constructor(
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private marcaService: MarcaService,
    private presentacionService: PresentacionService,
    private sucursalService: SucursalService,
    private gestoresService: GestoresService,
    private productosImagenService: ProductosImagenService,
    private comprasService: ComprasService,
    private preciosService: PreciosService,
    private router: Router,
    @Optional() public activeModal: NgbActiveModal,
    public sidebarState: SidebarStateService
  ) {
    this.esModal = !!this.activeModal;
  }

  ngOnInit(): void {
    this.initForm();
    this.cargarDatos();
    this.productoForm.get('useCorrelativo')?.valueChanges.subscribe(() => {
      this.onCheckboxChangeCorrelativo();
    });
    this.gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const item = (res?.data ?? []).find((c: { clave: string }) => c.clave === 'PRODUCTOS_CON_IMAGENES');
        this.productosConImagenes = item ? (String(item.valor).toLowerCase() === 'true') : false;
      },
      error: () => {}
    });
  }

  private initForm(): void {
    this.productoForm = this.fb.group({
      // Datos básicos
      codigo: ['', [Validators.required, Validators.minLength(2)]],
      useCorrelativo: [false],
      descripcion: ['', [Validators.required, Validators.minLength(3)]],
      idCategoria: ['', Validators.required],
      idMarca: ['', Validators.required],
      idPresentacion: ['', Validators.required],
      tipoProducto: ['S', Validators.required], // S: Simple, C: Compuesto, V: Variante
      
      // Control de stock
      alertaMinimo: [10, [Validators.min(0)]],
      alertaMaximo: [100, [Validators.min(0)]],
      
      // Fechas (opcionales)
      fProduccion: [''],
      fVencimiento: [''],
      
      // Estado
      estado: [true],

      // Precio
      idListaPrecio: [null]
    });
  }

  private cargarDatos(): void {
    this.cargandoDatos.set(true);
    let completados = 0;
    const total = 6;

    const verificarCompletado = () => {
      completados++;
      if (completados >= total) {
        this.cargandoDatos.set(false);
      }
    };

    // Cargar categorías
    this.categoriaService.obtener_categorias().subscribe({
      next: (response) => {
        this.categorias = response.data || [];
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar marcas
    this.marcaService.obtener_marcas().subscribe({
      next: (response) => {
        this.marcas = response.data || [];
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar presentaciones
    this.presentacionService.obtener_presentaciones().subscribe({
      next: (response) => {
        this.presentaciones = response.data || [];
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar sucursales
    this.sucursalService.obtener_sucursal_todos().subscribe({
      next: (response: { data?: Sucursal[] }) => {
        this.sucursales = response.data || [];
        if (this.sucursales.length > 0) {
          this.loteData.idSucursal = this.sucursales[0].idSucursal;
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar listas de precios
    this.preciosService.listar_listas_precios_empresa().subscribe({
      next: (response) => {
        this.listasPrecio = response?.data || [];
        const principal = this.listasPrecio.find((l: any) => l.principal === true || l.principal === 1);
        const idLista = principal?.idLista ?? this.listasPrecio[0]?.idLista ?? null;
        if (idLista != null) {
          this.productoForm.patchValue({ idListaPrecio: idLista });
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });

    // Cargar correlativo de productos
    this.comprasService.obtener_correlativo_empresa().subscribe({
      next: (res) => {
        const data = res?.data;
        this.correlativo = data && typeof data === 'object' ? data : this.correlativo;
        if (this.productoForm.get('useCorrelativo')?.value) {
          this.productoForm.patchValue({ codigo: this.correlativo.numero || '' });
        }
        verificarCompletado();
      },
      error: () => verificarCompletado()
    });
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
  }

  calcularPrecioVenta(): void {
    if (this.loteData.costoUnitario > 0 && this.margenGanancia > 0) {
      this.precioVenta = this.loteData.costoUnitario * (1 + this.margenGanancia / 100);
    }
  }

  calcularMargen(): void {
    if (this.loteData.costoUnitario > 0 && this.precioVenta > 0) {
      this.margenGanancia = ((this.precioVenta - this.loteData.costoUnitario) / this.loteData.costoUnitario) * 100;
    }
  }

  guardarProducto(): void {
    if (this.productoForm.invalid) {
      this.marcarCamposComoTocados();
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    this.guardando.set(true);

    const v = this.productoForm.value;
    const producto = {
      Codigo: v.codigo,
      useCorrelativo: !!v.useCorrelativo,
      idCategoria: Number(v.idCategoria),
      idMarca: Number(v.idMarca),
      descripcion: v.descripcion,
      idPresentacion: Number(v.idPresentacion),
      cUnitario: this.loteData.costoUnitario != null ? Number(this.loteData.costoUnitario) : 0,
      fProduccion: v.fProduccion || undefined,
      fVencimiento: v.fVencimiento || undefined,
      alertaMinimo: v.alertaMinimo != null ? Number(v.alertaMinimo) : 10,
      alertaMaximo: v.alertaMaximo != null ? Number(v.alertaMaximo) : 100,
      estado: !!v.estado,
      tipoProducto: (v.tipoProducto === 'C' || v.tipoProducto === 'S') ? v.tipoProducto : 'S',
      lote: this.modoLote() && this.loteData.idSucursal ? {
        idSucursal: this.loteData.idSucursal,
        costoUnitario: this.loteData.costoUnitario,
        cantidadIngresada: this.loteData.cantidadIngresada,
        ubicacion: this.loteData.ubicacion
      } : null,
      precioVenta: this.precioVenta && this.precioVenta > 0 ? this.precioVenta : 0,
      idListaPrecio: v.idListaPrecio != null && v.idListaPrecio !== '' ? Number(v.idListaPrecio) : null
    };

    this.productoService.crearProducto(producto).subscribe({
      next: (response) => {
        this.guardando.set(false);
        if (response.data) {
          const idProducto = typeof response.data === 'string' ? response.data : (response.data as { idProducto?: string })?.idProducto;
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Producto creado correctamente',
            position: 'topRight'
          });
          if (this.productosConImagenes && idProducto) {
            this.idProductoCreado = idProducto;
            this.imagenesProducto = [];
            this.activeTab.set('galeria');
            this.actualizarCorrelativoSiAplica();
          } else if (this.activeModal) {
            this.actualizarCorrelativoSiAplica();
            this.activeModal.close(true);
          } else {
            this.actualizarCorrelativoSiAplica();
            this.router.navigate(['/productos']);
          }
        } else {
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: response.message || 'Error al crear el producto',
            position: 'topRight'
          });
        }
      },
      error: (error) => {
        this.guardando.set(false);
        console.error('Error:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al crear el producto',
          position: 'topRight'
        });
      }
    });
  }

  onCheckboxChangeCorrelativo(): void {
    const useCorrelativo = !!this.productoForm.get('useCorrelativo')?.value;
    if (useCorrelativo) {
      this.codigoManual = this.productoForm.get('codigo')?.value || '';
      this.productoForm.patchValue({ codigo: this.correlativo.numero || '' });
    } else {
      this.productoForm.patchValue({ codigo: this.codigoManual || '' });
    }
  }

  private actualizarCorrelativoSiAplica(): void {
    const useCorrelativo = !!this.productoForm.get('useCorrelativo')?.value;
    if (!useCorrelativo || !this.correlativo?.idCorrelativo) return;
    const siguiente = (Number(this.correlativo.numero) || 0) + 1;
    const payload = { ...this.correlativo, numero: siguiente };
    this.comprasService.editar_correlativos_empresa(this.correlativo.idCorrelativo, payload).subscribe({
      next: () => {
        this.correlativo = payload;
      },
      error: (error) => {
        console.error('actualizarCorrelativoSiAplica:', error);
      }
    });
  }

  abrirNuevaCategoria(): void {
    window.open('/categorias/create', '_blank');
  }

  abrirNuevaMarca(): void {
    window.open('/marcas/create', '_blank');
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.productoForm.controls).forEach(key => {
      this.productoForm.get(key)?.markAsTouched();
    });
  }

  hasError(field: string): boolean {
    const control = this.productoForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  getError(field: string): string {
    const control = this.productoForm.get(field);
    if (control?.errors?.['required']) return 'Este campo es requerido';
    if (control?.errors?.['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control?.errors?.['min']) return `Valor mínimo: ${control.errors['min'].min}`;
    return '';
  }

  cancelar(): void {
    if (this.activeModal) {
      this.activeModal.dismiss();
    } else {
      this.router.navigate(['/productos']);
    }
  }

  onArchivosChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.archivosSeleccionados = Array.from(input.files).slice(0, 5 - this.imagenesProducto.length);
    }
  }

  subirImagenes(): void {
    if (!this.idProductoCreado || this.archivosSeleccionados.length === 0) return;
    this.subiendoImagenes = true;
    this.productosImagenService.subir(this.idProductoCreado, this.archivosSeleccionados).subscribe({
      next: () => {
        this.subiendoImagenes = false;
        this.archivosSeleccionados = [];
        this.cargarImagenesProducto();
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Imágenes subidas', position: 'topRight' });
      },
      error: () => {
        this.subiendoImagenes = false;
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudieron subir las imágenes', position: 'topRight' });
      }
    });
  }

  private cargarImagenesProducto(): void {
    if (!this.idProductoCreado) return;
    this.productosImagenService.listar(this.idProductoCreado).subscribe({
      next: (res) => { this.imagenesProducto = res.data || []; },
      error: () => {}
    });
  }

  eliminarImagen(idImagen: string): void {
    this.productosImagenService.eliminar(idImagen).subscribe({
      next: () => {
        this.imagenesProducto = this.imagenesProducto.filter(i => i.idImagen !== idImagen);
        if (typeof iziToast !== 'undefined') iziToast.success({ title: 'Imagen eliminada', position: 'topRight' });
      },
      error: () => {
        if (typeof iziToast !== 'undefined') iziToast.error({ title: 'Error', message: 'No se pudo eliminar', position: 'topRight' });
      }
    });
  }

  finalizarCreacion(): void {
    if (this.activeModal) this.activeModal.close(true);
    else this.router.navigate(['/productos']);
  }

  irAEditar(): void {
    if (this.idProductoCreado) this.router.navigate(['/productos/update', this.idProductoCreado]);
  }
}
