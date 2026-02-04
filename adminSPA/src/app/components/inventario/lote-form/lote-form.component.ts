import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LotesService } from '../../../services/lotes.service';
import { ProductoService } from '../../../services/producto.service';
import { SucursalService } from '../../../services/sucursal.service';
import { LoteCreate } from '../../../models/inventario.model';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

declare var iziToast: any;

@Component({
  selector: 'app-lote-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lote-form.component.html',
  styleUrl: './lote-form.component.css'
})
export class LoteFormComponent implements OnInit {
  // Formulario reactivo
  loteForm: FormGroup;
  
  // Modo edición o creación
  isEditMode = false;
  
  // ID del lote en modo edición
  @Input() idLote: string | null = null;
  @Input() idProducto: string | null = null;
  @Input() idSucursal: string | null = null;

  // Datos para selects
  productos: any[] = [];
  sucursales: any[] = [];

  // Estados
  cargando = false;
  guardando = false;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private loteService: LotesService,
    private productoService: ProductoService,
    private sucursalService: SucursalService
  ) {
    // Inicializa el formulario con validaciones
    this.loteForm = this.fb.group({
      idProducto: ['', [Validators.required]],
      idSucursal: ['', [Validators.required]],
      costoUnitario: [0, [Validators.required, Validators.min(0)]],
      cantidadIngresada: [0, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    // Detecta si estamos editando
    if (this.idLote) {
      this.isEditMode = true;
      this.cargarLote();
    } else {
      // Si hay datos iniciales, aplicarlos
      if (this.idProducto) {
        this.loteForm.patchValue({ idProducto: this.idProducto });
      }
      if (this.idSucursal) {
        this.loteForm.patchValue({ idSucursal: this.idSucursal });
      }
    }
    
    this.cargarDatosIniciales();
  }

  /**
   * Carga productos y sucursales para los selects
   */
  cargarDatosIniciales(): void {
    this.cargando = true;
    
    forkJoin({
      productos: this.productoService.obtenerProductosTodos(),
      sucursales: this.sucursalService.obtener_sucursal_todos()
    }).subscribe({
      next: (result) => {
        const dataProductos = result.productos?.data;
        this.productos = Array.isArray(dataProductos) ? dataProductos : (dataProductos ? [dataProductos] : []);
        this.sucursales = result.sucursales.data || [];
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando datos:', error);
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
   * Carga datos del lote en modo edición
   */
  cargarLote(): void {
    if (!this.idLote) return;
    
    this.cargando = true;
    this.loteService.obtener_lote_id(this.idLote).subscribe({
      next: (response: any) => {
        const lote = response.data || response;
        this.loteForm.patchValue({
          idProducto: lote.idProducto,
          idSucursal: lote.idSucursal,
          costoUnitario: lote.costoUnitario,
          cantidadIngresada: lote.cantidadIngresada
        });
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar lote', error);
        this.cargando = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'No se pudo cargar el lote',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Guarda el lote (crear o actualizar)
   */
  guardarLote(): void {
    if (this.loteForm.invalid) {
      this.marcarCamposComoTocados();
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;
    const loteData = this.loteForm.value;

    if (this.isEditMode && this.idLote) {
      // Modo edición
      this.loteService.actualizar_lote(this.idLote, loteData).subscribe({
        next: (response: any) => {
          this.guardando = false;
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Lote actualizado correctamente',
            position: 'topRight'
          });
          this.activeModal.close({ success: true, lote: response.data || loteData, modo: 'edicion' });
        },
        error: (error) => {
          this.guardando = false;
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.message || 'Error al actualizar el lote',
            position: 'topRight'
          });
        }
      });
    } else {
      // Modo creación
      const nuevoLote: LoteCreate = {
        ...loteData,
        cantidadDisponible: loteData.cantidadIngresada // Al crear, disponible = ingresado
      };

      this.loteService.crear_lote(nuevoLote).subscribe({
        next: (response: any) => {
          this.guardando = false;
          iziToast.show({
            title: 'Éxito',
            titleColor: '#28a745',
            message: 'Lote creado correctamente',
            position: 'topRight'
          });
          const loteCreado = response.data || nuevoLote;
          this.activeModal.close({ 
            success: true, 
            lote: loteCreado, 
            modo: 'creacion',
            idLote: loteCreado.idLote || response.data?.idLote
          });
        },
        error: (error) => {
          this.guardando = false;
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.message || 'Error al crear el lote',
            position: 'topRight'
          });
        }
      });
    }
  }

  /**
   * Marca todos los campos como tocados para mostrar errores
   */
  private marcarCamposComoTocados(): void {
    Object.keys(this.loteForm.controls).forEach(key => {
      this.loteForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.loteForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getError(field: string): string {
    const control = this.loteForm.get(field);
    if (control?.errors?.['required']) return 'Este campo es requerido';
    if (control?.errors?.['min']) return `El valor mínimo es ${control.errors['min'].min}`;
    return '';
  }

  /**
   * Cancela y cierra el modal
   */
  cancelar(): void {
    this.activeModal.dismiss();
  }

}
