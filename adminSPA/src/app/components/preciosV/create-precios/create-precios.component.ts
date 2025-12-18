import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PreciosService } from '../../../services/precios.service';
import { StockSucursal } from '../../../interfaces/stockSucursal-interface';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var bootstrap: any;

@Component({
  selector: 'app-create-precios',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, TopnavComponent],
  templateUrl: './create-precios.component.html',
  styleUrls: ['./create-precios.component.css']

})
export class CreatePreciosComponent implements OnInit {
  @ViewChild('modalNuevaLista') modalNuevaLista!: ElementRef;

  // Datos
  listasPrecio: any[] = [];
  productos: any[] = [];
  monedas: any[] = [];
  productosFiltrados: any[] = [];
  sucursales: any[] = [];
  
  // Estado
  listaSeleccionadaId: number | null = null;
  listaSeleccionada: any = null;
  listaEditar: any = null;
  filtroBusqueda: string = '';
  simboloMoneda: string = 'S/.';
  
  // Formulario
  formListaPrecio: FormGroup;
  
  // Modal
  modal: any;

  constructor(
    private fb: FormBuilder,
    private preciosService: PreciosService,
    private _productosService : ProductoService,
    private _sucursalService: SucursalService,
    private _tablasSunatService: TablasSunatService
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
    this.cargarListasPrecio();
    this.cargarProductos();
    this.cargarSucursales();
    this.cargarMonedas();
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
        console.log('Listas de precios cargadas:', this.listasPrecio);
      },
      error: (error) => {
        console.error('Error al cargar listas de precios:', error);
      }
    });
  }

  cargarProductos(): void {
    // Aquí deberías implementar el servicio para obtener productos
    // Por ahora, datos de ejemplo
    this._productosService.obtener_productos_todos().subscribe({
      next: (response) => {
        this.productos = response.data || [];
        this.productosFiltrados = [...this.productos];
        console.log(this.productos);
      },
      error: (error) => {
        console.error('Error al cargar productos:', error);
      }
    });
    
  }

  cargarSucursales(): void {
    // Implementar servicio para obtener sucursales
    this._sucursalService.obtener_sucursal_idempresa().subscribe({
      next: (response) => {
        this.sucursales = response.data || [];
        console.log('Sucursales cargadas:', response.data);
      },
      error: (error) => {
        console.error('Error al cargar sucursales:', error);
      }
    });
  }

  cargarMonedas(): void {
    this._tablasSunatService.obtener_moneda().subscribe({
      next: (response) => {
        this.monedas = response.data;
        console.log('Monedas cargadas:', response.data);
      },
      error: (error) => {
        console.error('Error al cargar monedas:', error);
      }
    });
  }

  // Eventos
  onListaSeleccionada(): void {
    this.listaSeleccionada = this.listasPrecio.find(
      lista => lista.idLista == this.listaSeleccionadaId
    );
    
    if (this.listaSeleccionada) {
      // Actualizar símbolo de moneda
      this.simboloMoneda = this.listaSeleccionada.idMoneda === 2 ? '$' : 'S/.';
       // Actualizar precioActual en cada producto
      this.productos.forEach(producto => {
        this.actualizarPrecioProducto(producto, this.listaSeleccionadaId!);
      });
      // Cargar precios para esta lista
      this.cargarPreciosProductos();
    }
  }
  
  // Método clave: Obtener precio de un producto para una lista específica
  actualizarPrecioProducto(producto: any, idLista: number): void {
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
    this.productos.forEach(producto => {
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
    this.productos.forEach(producto => {
      producto.precioActual = producto.nuevoPrecio || producto.precioActual;
      producto.nuevoPrecio = null;
    });
  }

  abrirModalNuevaLista(lista?: any): void {
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
    console.log('Guardando lista de precios...', this.formListaPrecio.value);
    if (this.formListaPrecio.invalid) return;
    
    const formData = this.formListaPrecio.value;
    console.log('Datos del formulario:', formData);
    
    if (formData.idLista) {
      // Editar
      console.log('Editando lista de precios...');
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
      console.log('Creando nueva lista de precios...');
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


  guardarPrecios(): void {
    console.log('Guardando precios...',this.listaSeleccionadaId);
    if (!this.listaSeleccionadaId) {
      alert('Selecciona una lista de precios primero');
      return;
    }
    
    const preciosAGuardar = this.productos
      .filter(producto => producto.nuevoPrecio && producto.nuevoPrecio !== producto.precioActual)
      .map(producto => ({
        idLista: this.listaSeleccionadaId,
        idProducto: producto.idProducto,
        idPrecio: producto.idPrecio, // Puede ser null para nuevos precios
        precio: producto.nuevoPrecio,
        idMoneda: this.listaSeleccionada.idMoneda,

        idUsuario: 'USUARIO_ACTUAL' // Obtener del servicio de autenticación
      }));
    
      console.log('Precios filtrados para guardar:', preciosAGuardar);

    if (preciosAGuardar.length === 0) {
      alert('No hay precios nuevos para guardar');
      return;
    }
    
    console.log('Precios a guardar:', preciosAGuardar);
 

    this.preciosService.creaer_precio_producto(preciosAGuardar).subscribe({
        next: (response) => {
          console.log('Precio guardado:', response);
        },
        error: (error) => {
          console.error('Error al guardar precio:', error);
        }
      });
    
    alert(`${preciosAGuardar.length} precios guardados correctamente`);
    this.cargarPreciosProductos();
  }

  // Funciones auxiliares
  filtrarProductos(): void {
    console.log('Filtro de búsqueda:', this.filtroBusqueda);
    if (!this.filtroBusqueda.trim()) {
      this.productosFiltrados = [...this.productos];
      return;
    }
    
    const termino = this.filtroBusqueda.toLowerCase();
    this.productosFiltrados = this.productos.filter(producto =>
      producto.descripcion.toLowerCase().includes(termino) ||
      producto.codigo.toLowerCase().includes(termino)
    );
  }

  validarPrecio(producto: any): void {
    if (producto.nuevoPrecio < 0) {
      producto.nuevoPrecio = 0;
    }
  }

  restaurarPrecio(producto: any): void {
    producto.nuevoPrecio = producto.precioActual;
  }

  calcularVariacion(producto: any): string {
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