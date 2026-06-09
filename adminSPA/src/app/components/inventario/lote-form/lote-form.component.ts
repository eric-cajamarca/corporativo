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
  loteForm: FormGroup;

  isEditMode = false;

  @Input() idLote: string | null = null;
  @Input() idProducto: string | null = null;
  @Input() idSucursal: string | null = null;

  productos: any[] = [];
  sucursales: any[] = [];

  cargando = false;
  guardando = false;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private loteService: LotesService,
    private productoService: ProductoService,
    private sucursalService: SucursalService
  ) {
    this.loteForm = this.fb.group({
      idProducto: ['', [Validators.required]],
      idSucursal: ['', [Validators.required]],
      costoUnitario: [0, [Validators.required, Validators.min(0)]],
      cantidadIngresada: [0, [Validators.required, Validators.min(1)]],
      cantidadDisponible: [0],
      activo: [true]
    });
  }

  ngOnInit(): void {
    if (this.idLote) {
      this.isEditMode = true;
      this.configurarFormularioEdicion();
      this.cargarLote();
    } else {
      if (this.idProducto) {
        this.loteForm.patchValue({ idProducto: this.idProducto });
      }
      if (this.idSucursal) {
        this.loteForm.patchValue({ idSucursal: this.idSucursal });
      }
    }

    this.cargarDatosIniciales();
  }

  private configurarFormularioEdicion(): void {
    this.loteForm.get('cantidadIngresada')?.clearValidators();
    this.loteForm.get('cantidadIngresada')?.updateValueAndValidity({ emitEvent: false });
    this.loteForm.get('cantidadDisponible')?.setValidators([Validators.required]);
    this.loteForm.get('cantidadDisponible')?.updateValueAndValidity({ emitEvent: false });
    this.loteForm.get('idProducto')?.disable({ emitEvent: false });
    this.loteForm.get('idSucursal')?.disable({ emitEvent: false });
  }

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

  cargarLote(): void {
    if (!this.idLote) return;

    this.cargando = true;
    this.loteService.obtener_lote_id(this.idLote).subscribe({
      next: (response: any) => {
        const lote = response.data || response;
        if (lote) {
          this.loteForm.patchValue({
            idProducto: lote.idProducto,
            idSucursal: lote.idSucursal,
            costoUnitario: lote.costoUnitario ?? 0,
            cantidadIngresada: lote.cantidadIngresada ?? 0,
            cantidadDisponible: lote.cantidadDisponible ?? 0,
            activo: lote.activo !== false && lote.activo !== 0
          });
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar lote', error);
        this.cargando = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'No se pudo cargar el lote',
          position: 'topRight'
        });
      }
    });
  }

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

    const raw = this.loteForm.getRawValue();
    this.guardando = true;
    this.loteForm.disable();

    if (this.isEditMode && this.idLote) {
      const loteData = {
        costoUnitario: Number(raw.costoUnitario) || 0,
        cantidadDisponible: Number(raw.cantidadDisponible),
        activo: !!raw.activo
      };

      this.loteService.actualizar_lote(this.idLote, loteData).subscribe({
        next: (response: any) => {
          this.guardando = false;
          this.loteForm.enable();
          this.configurarFormularioEdicion();
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
          this.loteForm.enable();
          this.configurarFormularioEdicion();
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.error || error.error?.message || 'Error al actualizar el lote',
            position: 'topRight'
          });
        }
      });
    } else {
      const nuevoLote: LoteCreate = {
        idProducto: raw.idProducto,
        idSucursal: raw.idSucursal,
        costoUnitario: Number(raw.costoUnitario) || 0,
        cantidadIngresada: Number(raw.cantidadIngresada) || 0
      };

      this.loteService.crear_lote({
        ...nuevoLote,
        cantidadDisponible: nuevoLote.cantidadIngresada,
        activo: true
      }).subscribe({
        next: (response: any) => {
          this.guardando = false;
          this.loteForm.enable();
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
          this.loteForm.enable();
          iziToast.show({
            title: 'Error',
            titleColor: '#dc3545',
            message: error.error?.error || error.error?.message || 'Error al crear el lote',
            position: 'topRight'
          });
        }
      });
    }
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.loteForm.controls).forEach(key => {
      this.loteForm.get(key)?.markAsTouched();
    });
  }

  hasError(field: string): boolean {
    const control = this.loteForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  getError(field: string): string {
    const control = this.loteForm.get(field);
    if (control?.errors?.['required']) return 'Este campo es requerido';
    if (control?.errors?.['min']) return `El valor mínimo es ${control.errors['min'].min}`;
    return '';
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }
}
