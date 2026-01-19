import { Component } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { LotesService } from '../../../services/lotes.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-venta-por-prioridad',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './venta-por-prioridad.component.html',
  styleUrl: './venta-por-prioridad.component.css'
})
export class VentaPorPrioridadComponent {

   // Formulario principal de venta
  ventaForm: FormGroup;
  
  // Stock disponible por producto (simulado)
  productos: any[] = [
    { id: '1', nombre: 'Producto 1', stockTotal: 110, precioVenta: 220 }
  ];

  constructor(
    private fb: FormBuilder,
    private loteService: LotesService,
    private loteUbicacionService: LotesUbicacionService
  ) {
    // Formulario con array de productos vendidos
    this.ventaForm = this.fb.group({
      idSucursal: ['', Validators.required],
      productosVendidos: this.fb.array([])
    });
  }

  ngOnInit(): void {
    this.agregarProductoVenta();
  }

  /**
   * Getter para el FormArray de productos vendidos
   */
  get productosVendidos(): FormArray {
    return this.ventaForm.get('productosVendidos') as FormArray;
  }

  /**
   * Agrega un producto a la venta
   */
  agregarProductoVenta(): void {
    const productoGroup = this.fb.group({
      idProducto: ['', Validators.required],
      cantidad: [0, [Validators.required, Validators.min(1)]]
    });
    this.productosVendidos.push(productoGroup);
  }

  /**
   * Elimina un producto de la venta
   */
  eliminarProductoVenta(index: number): void {
    this.productosVendidos.removeAt(index);
  }

  /**
   * Procesa la venta aplicando reglas de prioridad automáticamente
   */
  procesarVenta(): void {
    if (this.ventaForm.invalid) {
      alert('Complete todos los campos');
      return;
    }

    const { idSucursal, productosVendidos } = this.ventaForm.value;

   
    // Para cada producto vendido, aplica descuento por prioridad
    productosVendidos.forEach((producto: any) => {
       const datos = {
      idProducto: producto.idProducto,
      idSucursal,
      productosVendidos
      };
      this.loteUbicacionService.actualizar_cantidad_loteUbicacion(datos).subscribe({
        next: (movimientos) => {
          console.log('Movimientos generados:', movimientos);
          // Aquí guardarías la venta en tu tabla de ventas
          alert('Venta procesada correctamente');
        },
        error: (error) => alert('Error: ' + error.message)
      });
    });
  }


}
