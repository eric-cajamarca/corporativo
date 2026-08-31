import { Component, Input, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductoService } from '../../../services/producto.service';
import { SucursalService } from '../../../services/sucursal.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

declare var iziToast: any;

interface ProductoVenta {
  idProducto: string;
  nombre: string;
  codigo: string;
  stockDisponible: number;
  precioVenta: number;
  cantidad: number;
  movimientos?: any[];
}

@Component({
  selector: 'app-venta-por-prioridad',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './venta-por-prioridad.component.html',
  styleUrl: './venta-por-prioridad.component.css'
})
export class VentaPorPrioridadComponent implements OnInit {

  // Formulario principal de venta
  ventaForm: FormGroup;
  
  // Input opcional para pre-seleccionar sucursal
  @Input() idSucursal: string | null = null;
  
  // Productos disponibles con stock
  productos: any[] = [];
  productosFiltrados: any[] = [];
  
  // Sucursales
  sucursales: any[] = [];
  
  // Preview de movimientos por producto
  previewMovimientos: { [idProducto: string]: any[] } = {};
  
  // Estados
  cargando = true;
  procesando = false;
  buscandoProducto = '';

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private productoService: ProductoService,
    private sucursalService: SucursalService,
    private loteUbicacionService: LotesUbicacionService
  ) {
    // Formulario con array de productos vendidos
    this.ventaForm = this.fb.group({
      idSucursal: ['', Validators.required],
      productosVendidos: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.cargarDatosIniciales();
    
    // Si hay sucursal pre-seleccionada, aplicarla
    if (this.idSucursal) {
      this.ventaForm.patchValue({ idSucursal: this.idSucursal });
    }
  }

  /**
   * Carga productos y sucursales
   */
  cargarDatosIniciales(): void {
    this.cargando = true;
    
    forkJoin({
      productos: this.productoService.obtenerProductosTodos(),
      sucursales: this.sucursalService.obtener_sucursal_todos()
    }).subscribe({
      next: (result) => {
        const data = result.productos?.data;
        this.productos = Array.isArray(data) ? data : (data ? [data] : []);
        this.productosFiltrados = this.productos;
        this.sucursales = result.sucursales.data || [];
        this.cargando = false;
        
        if (this.productos.length === 0) {
          iziToast.show({
            title: 'Advertencia',
            titleColor: '#ffc107',
            message: 'No hay productos disponibles',
            position: 'topRight'
          });
        }
      },
      error: (error) => {
        this.cargando = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar productos y sucursales',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Getter para el FormArray de productos vendidos
   */
  get productosVendidos(): FormArray {
    return this.ventaForm.get('productosVendidos') as FormArray;
  }

  /**
   * Filtra productos por búsqueda
   */
  filtrarProductos(): void {
    if (!this.buscandoProducto) {
      this.productosFiltrados = this.productos;
      return;
    }
    
    const term = new RegExp(this.buscandoProducto, 'i');
    this.productosFiltrados = this.productos.filter(p => 
      term.test(p.descripcion || '') || 
      term.test(p.codigo || '')
    );
  }

  /**
   * Agrega un producto a la venta
   */
  agregarProductoVenta(producto?: any): void {
    const productoGroup = this.fb.group({
      idProducto: [producto?.idProducto || '', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(1)]]
    });
    
    this.productosVendidos.push(productoGroup);
    
    // Si se agregó un producto específico, calcular movimientos
    if (producto) {
      this.calcularMovimientosProducto(this.productosVendidos.length - 1, producto.idProducto, 1);
    }
    
    this.buscandoProducto = '';
    this.filtrarProductos();
  }

  /**
   * Elimina un producto de la venta
   */
  eliminarProductoVenta(index: number): void {
    const producto = this.productosVendidos.at(index).value;
    delete this.previewMovimientos[producto.idProducto];
    this.productosVendidos.removeAt(index);
  }

  /**
   * Obtiene información del producto
   */
  getProductoInfo(idProducto: string): any {
    return this.productos.find(p => p.idProducto === idProducto);
  }

  /**
   * Calcula los movimientos necesarios para un producto
   */
  calcularMovimientosProducto(index: number, idProducto: string, cantidad: number): void {
    const idSucursal = this.ventaForm.get('idSucursal')?.value;
    if (!idSucursal || !idProducto || cantidad <= 0) {
      delete this.previewMovimientos[idProducto];
      return;
    }

    // Aquí deberías llamar al backend para obtener las ubicaciones por prioridad
    // Por ahora simulamos la lógica
    this.previewMovimientos[idProducto] = [
      { ubicacion: 'A-01-01', cantidad: Math.min(cantidad, 30), prioridad: 1 },
      { ubicacion: 'A-01-02', cantidad: Math.max(0, cantidad - 30), prioridad: 2 }
    ].filter(m => m.cantidad > 0);
  }

  /**
   * Cuando cambia la cantidad de un producto
   */
  onCantidadChange(index: number): void {
    const productoGroup = this.productosVendidos.at(index);
    const idProducto = productoGroup.get('idProducto')?.value;
    const cantidad = productoGroup.get('cantidad')?.value || 0;
    
    if (idProducto && cantidad > 0) {
      this.calcularMovimientosProducto(index, idProducto, cantidad);
    }
  }

  /**
   * Cuando selecciona un producto
   */
  onProductoSeleccionado(index: number): void {
    const productoGroup = this.productosVendidos.at(index);
    const idProducto = productoGroup.get('idProducto')?.value;
    const cantidad = productoGroup.get('cantidad')?.value || 1;
    
    if (idProducto) {
      this.calcularMovimientosProducto(index, idProducto, cantidad);
    }
  }

  /**
   * Obtiene el total de la venta
   */
  getTotalVenta(): number {
    let total = 0;
    this.productosVendidos.controls.forEach(control => {
      const idProducto = control.get('idProducto')?.value;
      const cantidad = control.get('cantidad')?.value || 0;
      const producto = this.getProductoInfo(idProducto);
      if (producto) {
        total += (producto.pVenta || 0) * cantidad;
      }
    });
    return total;
  }

  /**
   * Procesa la venta aplicando reglas de prioridad automáticamente
   */
  procesarVenta(): void {
    if (this.ventaForm.invalid) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    const { idSucursal, productosVendidos } = this.ventaForm.value;

    if (productosVendidos.length === 0) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Agregue al menos un producto a la venta',
        position: 'topRight'
      });
      return;
    }

    this.procesando = true;

    // Aquí deberías integrar con el servicio de ventas real
    // Por ahora solo mostramos un mensaje de éxito
    setTimeout(() => {
      this.procesando = false;
      iziToast.show({
        title: 'Éxito',
        titleColor: '#28a745',
        message: `Venta procesada correctamente. Total: S/ ${this.getTotalVenta().toFixed(2)}`,
        position: 'topRight'
      });
      this.activeModal.close({ 
        success: true, 
        productosVendidos,
        total: this.getTotalVenta()
      });
    }, 1500);
  }

  /**
   * Cierra el modal
   */
  cancelar(): void {
    this.activeModal.dismiss();
  }
}
