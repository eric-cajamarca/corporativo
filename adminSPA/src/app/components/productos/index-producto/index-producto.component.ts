import { Component, ElementRef, ViewChild } from '@angular/core';
import { signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ComprasService } from '../../../services/compras.service';
import { SucursalService } from '../../../services/sucursal.service';
import { ProductoService } from '../../../services/producto.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { ProductoCompuestoService } from '../../../services/producto-compuesto.service';
import { ProductovarianteService } from '../../../services/productovariante.service';
import { ProductoDetalleModalService } from '../../../services/producto-detalle-modal.service';
import { ProductoEditarModalService } from '../../../services/producto-editar-modal.service';
import { ProductoCrearModalService } from '../../../services/producto-crear-modal.service';
import { GestoresService } from '../../../services/gestores.service';
import { ProductoGaleriaModalService } from '../../../services/producto-galeria-modal.service';
import { ExcelService } from '../../../services/excel.service';
import { ImportacionProductosValidarData, ImportacionProductosEjecutarData } from '../../../models/producto.models';

declare var iziToast: any;
 declare var bootstrap: any;

@Component({
  selector: 'app-index-producto',
  imports: [FormsModule,RouterModule, CommonModule, TopnavComponent, SidebarComponent, NgbPagination],
  templateUrl: './index-producto.component.html',
  styleUrl: './index-producto.component.css'
})
export class IndexProductoComponent {
  // NUEVAS VARIABLES PARA MODALES
  @ViewChild('modalConvertirCompuesto') modalConvertirCompuesto!: ElementRef;
  @ViewChild('modalGestionarVariantes') modalGestionarVariantes!: ElementRef;
  
  public productos: Array<any> = [];
  public productos_const: Array<any> = [];
  public token: any = "";
  public filtro = '';
  public load_estado = false;
  /** Configuración inventario: galería de imágenes habilitada */
  public productosConImagenes = false;

  /** Importación Excel */
  archivoImportacion: File | null = null;
  resultadoValidacionImportacion: ImportacionProductosValidarData | null = null;
  resultadoEjecucionImportacion: ImportacionProductosEjecutarData | null = null;
  descargandoPlantilla = false;
  validandoImportacion = false;
  importandoEjecucion = false;

  // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

 
  productoSeleccionado: any = null;
  
  // Propiedades
  modoEdicion: boolean = false;

  // Variables para Producto Compuesto
  componentesKit: Array<any> = [];
  productosDisponibles: Array<any> = [];
  stockKitCalculado: number | null = null;
  
  // Variables para Variantes
  atributosProducto: Array<any> = [];
  nuevoAtributo: any = { nombre: '', valores: [] };
  combinacionesGeneradas: Array<any> = [];
  variantesCreadas: Array<any> = [];
  
  // Instancias de modales
  modalCompuestoInstance: any;
  modalVarianteInstance: any;


  constructor(
    
    private _router: Router,
    private _comprasService: ComprasService,
    private _sucursalService: SucursalService,
    private _productoService: ProductoService,
    private _productoCompuestoService: ProductoCompuestoService,
    private _productoVarianteService: ProductovarianteService,
    private _productoDetalleModal: ProductoDetalleModalService,
    private _productoEditarModal: ProductoEditarModalService,
    private _productoCrearModal: ProductoCrearModalService,
    private _gestoresService: GestoresService,
    private _productoGaleriaModal: ProductoGaleriaModalService,
    private _excelService: ExcelService,
    public sidebarState: SidebarStateService,
  ) {
   // this.token = this._cookieService.get('token');
  }

    ngAfterViewInit(): void {
    // Inicializar modales después de que la vista esté cargada
    if (this.modalConvertirCompuesto?.nativeElement) {
      this.modalCompuestoInstance = new bootstrap.Modal(this.modalConvertirCompuesto.nativeElement);
    }
    if (this.modalGestionarVariantes?.nativeElement) {
      this.modalVarianteInstance = new bootstrap.Modal(this.modalGestionarVariantes.nativeElement);
    }
  }

  ngOnInit(): void {
    this.initData();
    this._gestoresService.obtenerConfiguracion().subscribe({
      next: (res) => {
        const item = (res?.data ?? []).find((c: { clave: string }) => c.clave === 'PRODUCTOS_CON_IMAGENES');
        this.productosConImagenes = item ? String(item.valor).toLowerCase() === 'true' : false;
      },
      error: () => {}
    });
  }

  reiniciarModalImportacion(): void {
    this.archivoImportacion = null;
    this.resultadoValidacionImportacion = null;
    this.resultadoEjecucionImportacion = null;
  }

  onArchivoImportacionChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files && input.files[0];
    this.archivoImportacion = f || null;
    this.resultadoValidacionImportacion = null;
    this.resultadoEjecucionImportacion = null;
  }

  descargarPlantillaImportacion(): void {
    this.descargandoPlantilla = true;
    this._productoService.descargarPlantillaImportacionProductos().subscribe({
      next: (blob) => {
        this.descargandoPlantilla = false;
        this._excelService.descargar(blob, 'plantilla_importacion_productos.xlsx');
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Listo', message: 'Plantilla descargada.', position: 'topRight' });
        }
      },
      error: (err) => {
        this.descargandoPlantilla = false;
        const msg = err?.error?.message || 'No se pudo descargar la plantilla (¿permisos de administrador?).';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      }
    });
  }

  validarImportacion(): void {
    if (!this.archivoImportacion) return;
    this.validandoImportacion = true;
    this.resultadoEjecucionImportacion = null;
    this._productoService.validarImportacionProductos(this.archivoImportacion).subscribe({
      next: (res) => {
        this.validandoImportacion = false;
        this.resultadoValidacionImportacion = res.data;
        if (typeof iziToast !== 'undefined') {
          iziToast.info({
            title: 'Validación',
            message: `${res.data.validas} filas válidas, ${res.data.conError} con error.`,
            position: 'topRight'
          });
        }
      },
      error: (err) => {
        this.validandoImportacion = false;
        const msg = err?.error?.message || 'Error al validar el archivo.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      }
    });
  }

  ejecutarImportacion(): void {
    if (!this.archivoImportacion) return;
    this.importandoEjecucion = true;
    this._productoService.ejecutarImportacionProductos(this.archivoImportacion).subscribe({
      next: (res) => {
        this.importandoEjecucion = false;
        this.resultadoEjecucionImportacion = res.data;
        this.initData();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({
            title: 'Importación',
            message: `Se registraron ${res.data.insertados} producto(s).`,
            position: 'topRight'
          });
        }
      },
      error: (err) => {
        this.importandoEjecucion = false;
        const msg = err?.error?.message || 'Error al importar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
        }
      }
    });
  }

  abrirGaleriaProducto(item: { idProducto?: string; codigo?: string; descripcion?: string }): void {
    if (!item?.idProducto) return;
    const etiqueta = [item.codigo, item.descripcion].filter((x) => !!x && String(x).trim() !== '').join(' — ');
    this._productoGaleriaModal.abrir(item.idProducto, etiqueta).catch(() => {});
  }

  initData() {
    this._productoService.obtenerProductosTodos().subscribe(
      (response: any) => {
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a compras'
          });
          this._router.navigate(['/']);
        } else {
          this.productos = response.data;
          this.productos_const = response.data;
        }
      },
      (error: any) => {
        console.error('Error al cargar productos:', error);
      }
    );
  }

  /**
   * Buscar: con input vacío (o solo espacios) recarga todos los productos desde el servidor.
   * Con texto, filtra en memoria por campos del producto (código, descripción, categoría, etc.).
   */
  filtrar(): void {
    const q = (this.filtro ?? '').trim();
    this.page = 1;

    if (!q) {
      this.initData();
      return;
    }

    const ql = q.toLowerCase();
    const incluye = (v: unknown): boolean => {
      if (v === null || v === undefined) return false;
      return String(v).toLowerCase().includes(ql);
    };

    this.productos = this.productos_const.filter(
      (item) =>
        incluye(item.codigo) ||
        incluye(item.descripcion) ||
        incluye(item.categoria) ||
        incluye(item.codigoPresentacion) ||
        incluye(item.fProduccion) ||
        incluye(item.fVencimiento) ||
        incluye(item.tipoProducto)
    );
  }

  abrirDetalleProducto(idProducto: string): void {
    this._productoDetalleModal.abrir(idProducto).then(() => {
      this.initData();
    }).catch(() => {});
  }

  abrirEditarProducto(idProducto: string): void {
    this._productoEditarModal.abrir(idProducto).then(() => {
      this.initData();
    }).catch(() => {});
  }

  abrirCrearProducto(): void {
    this._productoCrearModal.abrir().then((r) => {
      if (r) {
        this.initData();
      }
    });
  }


  setEliminar(id: string) {
    this._productoService.eliminarProducto(id).subscribe(
      (response: any) => {
        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Error al eliminar el producto'
          });
          
        } else {
          this.initData();

          // Cierra el modal manualmente
          const modal = document.getElementById('.modal-backdrop');
          const modalInstance = bootstrap.Modal.getInstance(modal);
          modalInstance?.hide();

          // $('body').removeClass('modal-open');
          // $('.modal-backdrop').remove();
          // //habilitar el scroll en el body en el componente
          // $('body').css('overflow-y', 'auto');

        }

      },
      (error: any) => {
        console.error('Error al eliminar producto:', error);
      }
    );




  }

  onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }

  // NUEVOS MÉTODOS PARA PRODUCTOS COMPUESTOS
  
  
  abrirModalConvertirCompuesto(producto: any): void {
    // VERIFICAR que el modal esté inicializado
    if (!this.modalCompuestoInstance) {
      this.inicializarModalCompuesto();
    }
    
    this.productoSeleccionado = producto;
    this.componentesKit = [];
    this.stockKitCalculado = null;
    
    // Filtrar productos disponibles
    this.productosDisponibles = this.productos_const.filter(p => 
      p.idProducto !== producto.idProducto && 
      p.tipoProducto === 'S'
    );
    
    this.agregarComponente();
    
    // Verificar nuevamente antes de mostrar
    if (this.modalCompuestoInstance) {
      this.modalCompuestoInstance.show();
    } else {
      console.error('Modal no inicializado');
      // Fallback: mostrar alerta o alternativa
      alert('Por favor, recarga la página o contacta al administrador');
    }
  }
  
  // Método para inicializar el modal si no está listo
  inicializarModalCompuesto(): void {
    if (this.modalConvertirCompuesto?.nativeElement && !this.modalCompuestoInstance) {
      this.modalCompuestoInstance = new bootstrap.Modal(this.modalConvertirCompuesto.nativeElement);
    }
  }
  
  abrirModalGestionarVariantes(producto: any): void {
    // VERIFICAR que el modal esté inicializado
    if (!this.modalVarianteInstance) {
      this.inicializarModalVariante();
    }
    
    this.productoSeleccionado = producto;
    this.atributosProducto = [];
    this.combinacionesGeneradas = [];
    this.variantesCreadas = [];
    this.nuevoAtributo = { nombre: '', valores: [] };
    
    this.cargarAtributosProducto();
    
    // Verificar antes de mostrar
    if (this.modalVarianteInstance) {
      this.modalVarianteInstance.show();
    } else {
      console.error('Modal de variantes no inicializado');
      alert('Por favor, recarga la página o contacta al administrador');
    }
  }
  
  inicializarModalVariante(): void {
    if (this.modalGestionarVariantes?.nativeElement && !this.modalVarianteInstance) {
      this.modalVarianteInstance = new bootstrap.Modal(this.modalGestionarVariantes.nativeElement);
    }
  }







  
  agregarComponente(): void {
    this.componentesKit.push({
      idProductoHijo: '',
      cantidad: 1,
      stockDisponible: 0
    });
  }
  
  eliminarComponente(index: number): void {
    this.componentesKit.splice(index, 1);
  }
  
  onProductoComponenteChange(componente: any, index: number): void {
    if (componente.idProductoHijo) {
      // Aquí podrías hacer una llamada al servicio para obtener stock del producto
      // Por ahora, usamos datos locales
      const producto = this.productosDisponibles.find(p => p.idProducto === componente.idProductoHijo);
      componente.stockDisponible = producto?.stock || 0;
    }
  }
  
  esProductoPadre(idProducto: string): boolean {
    return idProducto === this.productoSeleccionado?.idProducto;
  }
  
  calcularStockKit(): void {
    if (this.componentesKit.length === 0) {
      this.stockKitCalculado = 0;
      return;
    }
    
    // Calcular stock mínimo basado en componentes
    const stocks = this.componentesKit
      .filter(c => c.idProductoHijo && c.cantidad > 0)
      .map(c => Math.floor(c.stockDisponible / c.cantidad));
    
    this.stockKitCalculado = stocks.length > 0 ? Math.min(...stocks) : 0;
  }
  
  puedeConvertirACompuesto(): boolean {
    // Validar que haya al menos un componente válido
    return this.componentesKit.some(c => 
      c.idProductoHijo && c.cantidad > 0
    ) && this.componentesKit.length > 0;
  }
  
  confirmarConversionCompuesto(): void {
    if (!this.productoSeleccionado) return;
    
    // Filtrar componentes válidos
    const componentesValidos = this.componentesKit.filter(c => 
      c.idProductoHijo && c.cantidad > 0
    );
    
        // Llamar al servicio para convertir a compuesto
    this._productoCompuestoService.crear_producto_compuesto({
      idProductoPadre: this.productoSeleccionado.idProducto,
      componentes: componentesValidos
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Producto convertido a kit exitosamente',
          position: 'topRight'
        });
        
        // Actualizar lista de productos
        this.initData();
        this.modalCompuestoInstance.hide();
      },
      error: (error) => {
        console.error('Error al convertir a compuesto:', error);
        iziToast.error({
          title: 'Error',
          message: 'No se pudo convertir el producto',
          position: 'topRight'
        });
      }
    });
  }
  
  // NUEVOS MÉTODOS PARA VARIANTES
  
 
  
  cargarAtributosProducto(): void {
    if (!this.productoSeleccionado) return;
    
    this._productoVarianteService.obtener_variantes_producto(this.productoSeleccionado.idProducto)
      .subscribe({
        next: (response) => {
          this.atributosProducto = response.data || [];
        },
        error: (error) => {
          console.error('Error al cargar atributos:', error);
        }
      });
  }
  
  agregarAtributo(): void {


    if (!this.nuevoAtributo.nombre.trim()) return;
    
    // Verificar que no exista ya
    const existe = this.atributosProducto.some(a => 
      a.nombre.toLowerCase() === this.nuevoAtributo.nombre.toLowerCase()
    );
    
    if (!existe) {
      this.atributosProducto.push({
        nombre: this.nuevoAtributo.nombre,
        valores: []
      });
      this.nuevoAtributo.nombre = '';
    }

      }
  
  eliminarAtributo(atributo: any): void {
    const index = this.atributosProducto.indexOf(atributo);
    if (index > -1) {
      this.atributosProducto.splice(index, 1);
      this.combinacionesGeneradas = [];
      this.variantesCreadas = [];
    }
  }
  
  agregarValorAtributo(atributo: any): void {
    const valor = prompt(`Ingrese valor para ${atributo.nombre}:`);
    if (valor && valor.trim()) {
      if (!atributo.valores.includes(valor.trim())) {
        atributo.valores.push(valor.trim());
        this.combinacionesGeneradas = [];
        this.variantesCreadas = [];
      }
    }
  }
  
  generarCombinaciones(): void {
    if (this.atributosProducto.length < 0) return;
    
    // Generar todas las combinaciones posibles
    let combinaciones: Array<any> = [{}];
    
    this.atributosProducto.forEach(atributo => {
      const nuevasCombinaciones: Array<any> = [];
      combinaciones.forEach(combinacion => {
        atributo.valores.forEach((valor: string) => {
          nuevasCombinaciones.push({
            ...combinacion,
            [atributo.nombre]: valor
          });
        });
      });
      combinaciones = nuevasCombinaciones;
    });
    
    this.combinacionesGeneradas = combinaciones;
    
    // Crear variantes a partir de combinaciones
    this.variantesCreadas = combinaciones.map((combinacion, index) => ({
      id: `var-${index + 1}`,
      sku: this.generarSKUVariante(combinacion),
      atributos: combinacion,
      precio: this.productoSeleccionado?.precio || 0,
      stockInicial: 0
    }));
  }
  
  generarSKUVariante(combinacion: any): string {
    const baseSKU = this.productoSeleccionado?.codigo || 'VAR';
    const valores = Object.values(combinacion).join('-');
    return `${baseSKU}-${valores}`.toUpperCase();
  }
  
  limpiarCombinaciones(): void {
    this.combinacionesGeneradas = [];
    this.variantesCreadas = [];
  }
  
  eliminarVariante(index: number): void {
    this.variantesCreadas.splice(index, 1);
  }
  
  puedeCrearVariantes(): boolean {
    return this.variantesCreadas.length > 0 && 
           this.variantesCreadas.every(v => v.sku && v.sku.trim() !== '');
  }
  
  crearVariantes(): void {
    if (!this.productoSeleccionado || !this.puedeCrearVariantes()) return;
    
    this._productoVarianteService.crear_variante({
      idProductoBase: this.productoSeleccionado.idProducto,
      variantes: this.variantesCreadas
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: `${response.data?.variantesCreadas || 0} variantes creadas exitosamente`,
          position: 'topRight'
        });
        
        // Actualizar lista de productos
        this.initData();
        this.modalVarianteInstance.hide();
      },
      error: (error) => {
        console.error('Error al crear variantes:', error);
        iziToast.error({
          title: 'Error',
          message: 'No se pudieron crear las variantes',
          position: 'topRight'
        });
      }
    });
  }

  verVariantesProducto(_item: any){
    
  }
  
  verComponentesKit(_item: any){
        this._productoCompuestoService.obtener_componentes(_item.idProducto).subscribe(
      response => {
                        if (response.data == undefined) {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Usted no tiene acceso a compras'
          });
          this._router.navigate(['/']);
        }
        else { {

          this.componentesKit = response.data.componentes;
          this.productosDisponibles = response.data.infoStock;

          // Asumiendo que response.data.infoStock es el objeto que mostraste
          const infoStock = response.data.infoStock;

          let mensaje = `Sucursales con stock:\n\n`;
          infoStock.sucursales.forEach((suc: any) => {
            if (suc.stockDisponible > 0) {
              mensaje += `- ${suc.sucursal} (Stock: ${suc.stockDisponible})\n`;
            }
          });

          alert(mensaje);

          this.abrirModalVerEditarCompuesto(_item);
        }
      }
      },
      error => {
              }
    );
    

    
  }


  // Abrir modal
abrirModalVerEditarCompuesto(producto: any): void {
  this.inicializarModalCompuesto();


  
  this.productoSeleccionado = producto;
  this.modoEdicion = true;
  this.cargarComponentesDeKit(producto.idProducto);
  // Abrir modal con Bootstrap
}

// Cargar componentes existentes
cargarComponentesDeKit(idProductoPadre: string): void {
  this._productoCompuestoService.obtener_componentes(idProductoPadre).subscribe({
    next: (response) => {
      this.componentesKit = response.data.componentes;
      this.calcularStockKit();
    }
  });
}


// Guardar cambios
guardarComponentesKit(): void {
  const data = {
    idProductoPadre: this.productoSeleccionado.idProducto,
    componentes: this.componentesKit
  };
  
  // this.servicio.actualizarComponentesKit(data).subscribe({
  //   next: () => {
  //     this.toastr.success('Kit actualizado correctamente');
  //     this.modoEdicion = false;
  //   }
  // });
}

 
}


