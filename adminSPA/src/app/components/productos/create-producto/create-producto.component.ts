import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ProductoService } from '../../../services/producto.service';
import { CategoriaService } from '../../../services/categoria.service';
import { MarcaService } from '../../../services/marca.service';
import { PresentacionService } from '../../../services/presentacion.service';
import { SucursalService } from '../../../services/sucursal.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';

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
    SidebarComponent
  ],
  templateUrl: './create-producto.component.html',
  styleUrl: './create-producto.component.css'
})
export class CreateProductoComponent implements OnInit {
  // Estado del sidebar
  sidebarCollapsed = signal<boolean>(false);

  // Formulario
  productoForm!: FormGroup;
  
  // Datos para selects
  categorias: Categoria[] = [];
  marcas: Marca[] = [];
  presentaciones: Presentacion[] = [];
  sucursales: Sucursal[] = [];

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

  constructor(
    private fb: FormBuilder,
    private productoService: ProductoService,
    private categoriaService: CategoriaService,
    private marcaService: MarcaService,
    private presentacionService: PresentacionService,
    private sucursalService: SucursalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarDatos();
    
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') {
      this.sidebarCollapsed.set(true);
    }
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  private initForm(): void {
    this.productoForm = this.fb.group({
      // Datos básicos
      codigo: ['', [Validators.required, Validators.minLength(2)]],
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
      estado: [true]
    });
  }

  private cargarDatos(): void {
    this.cargandoDatos.set(true);
    let completados = 0;
    const total = 4;

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
    this.sucursalService.obtener_sucursales().subscribe({
      next: (response) => {
        this.sucursales = response.data || [];
        if (this.sucursales.length > 0) {
          this.loteData.idSucursal = this.sucursales[0].idSucursal;
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

    const producto = {
      ...this.productoForm.value,
      cUnitario: this.loteData.costoUnitario || 0,
      // Datos de lote si está activo
      lote: this.modoLote() ? {
        idSucursal: this.loteData.idSucursal,
        costoUnitario: this.loteData.costoUnitario,
        cantidadIngresada: this.loteData.cantidadIngresada,
        ubicacion: this.loteData.ubicacion
      } : null,
      // Precio de venta
      precioVenta: this.precioVenta || 0
    };

    this.productoService.crearProducto(producto).subscribe({
      next: (response) => {
        this.guardando.set(false);
        if (response.data) {
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Producto creado correctamente',
            position: 'topRight'
          });
          this.router.navigate(['/productos']);
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
    this.router.navigate(['/productos']);
  }
}
