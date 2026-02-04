import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LotesService } from '../../../services/lotes.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { CommonModule } from '@angular/common';

declare var iziToast: any;

@Component({
  selector: 'app-movimiento-ubicacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './movimiento-ubicacion.component.html',
  styleUrl: './movimiento-ubicacion.component.css'
})
export class MovimientoUbicacionComponent implements OnInit {

  // Formulario para el traslado
  movimientoForm: FormGroup;
  
  // Input opcional para pre-seleccionar lote
  @Input() idLote: string | null = null;
  
  // Lista de lotes disponibles
  lotes: any[] = [];
  
  // Ubicaciones origen y destino
  ubicacionesOrigen: any[] = [];
  ubicacionesDestino: any[] = [];
  
  // Estados
  cargandoLotes = true;
  cargandoUbicaciones = false;
  ejecutando = false;
  
  // Stock disponible en ubicación origen seleccionada
  stockDisponibleOrigen = 0;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private loteService: LotesService,
    private loteUbicacionService: LotesUbicacionService,
    private ubicacionService: UbicacionPrioridadService
  ) {
    this.movimientoForm = this.fb.group({
      idLote: ['', Validators.required],
      idUbicacionOrigen: ['', Validators.required],
      idUbicacionDestino: ['', Validators.required],
      cantidad: [0, [Validators.required, Validators.min(1)]]
    });
  }

  ngOnInit(): void {
    this.cargarLotes();
    this.actualizarEstadoControles();
    // Si hay idLote pre-seleccionado, aplicarlo
    if (this.idLote) {
      this.movimientoForm.patchValue({ idLote: this.idLote });
      setTimeout(() => this.onLoteSeleccionado(), 100);
    }
  }

  /**
   * Carga todos los lotes de la empresa
   */
  cargarLotes(): void {
    this.cargandoLotes = true;
    this.loteService.obtener_lotes_todos().subscribe({
      next: (response: any) => {
        this.lotes = response.data || [];
        this.cargandoLotes = false;
      },
      error: (error) => {
        console.error('Error cargando lotes', error);
        this.cargandoLotes = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar los lotes',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cuando seleccionan un lote, carga sus ubicaciones actuales
   */
  onLoteSeleccionado(): void {
    const idLote = this.movimientoForm.get('idLote')?.value;
    if (!idLote) {
      this.ubicacionesOrigen = [];
      this.ubicacionesDestino = [];
      this.actualizarEstadoControles();
      return;
    }

    this.cargandoUbicaciones = true;
    this.movimientoForm.patchValue({ idUbicacionOrigen: '', idUbicacionDestino: '', cantidad: 0 });
    this.stockDisponibleOrigen = 0;

    // Cargar ubicaciones del lote
    this.loteUbicacionService.obtener_ubicacionLote_idLote(idLote).subscribe({
      next: (response: any) => {
        const data = response.data || response;
        this.ubicacionesOrigen = Array.isArray(data) ? data : [];
        
        // Para destino, carga todas las ubicaciones de la sucursal del lote
        const loteSeleccionado = this.lotes.find(l => l.idLote === idLote);
        const idSucursal = loteSeleccionado?.idSucursal;
        
        if (idSucursal) {
          this.ubicacionService.obtener_ubicacionesPrioridad_sucursal(idSucursal).subscribe({
            next: (ubicaciones: any) => {
              const ubicacionesData = Array.isArray(ubicaciones) ? ubicaciones : (ubicaciones.data || []);
              // Excluir la ubicación origen de las opciones de destino
              this.ubicacionesDestino = ubicacionesData.filter((u: any) => 
                u.idUbicacion !== this.movimientoForm.get('idUbicacionOrigen')?.value
              );
              this.cargandoUbicaciones = false;
              this.actualizarEstadoControles();
            },
            error: () => {
              this.cargandoUbicaciones = false;
              this.actualizarEstadoControles();
            }
          });
        } else {
          this.cargandoUbicaciones = false;
          this.actualizarEstadoControles();
        }
      },
      error: (error) => {
        console.error('Error cargando ubicaciones', error);
        this.cargandoUbicaciones = false;
        this.actualizarEstadoControles();
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar las ubicaciones del lote',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cuando seleccionan ubicación origen, actualiza stock disponible
   */
  onUbicacionOrigenSeleccionada(): void {
    const idUbicacionOrigen = this.movimientoForm.get('idUbicacionOrigen')?.value;
    if (!idUbicacionOrigen) {
      this.stockDisponibleOrigen = 0;
      this.actualizarEstadoControles();
      return;
    }

    const ubicacion = this.ubicacionesOrigen.find(u => u.idUbicacion === idUbicacionOrigen);
    this.stockDisponibleOrigen = ubicacion?.cantidad || 0;
    this.actualizarEstadoControles();
    // Resetear cantidad si excede el disponible
    const cantidadActual = this.movimientoForm.get('cantidad')?.value || 0;
    if (cantidadActual > this.stockDisponibleOrigen) {
      this.movimientoForm.patchValue({ cantidad: this.stockDisponibleOrigen });
    }
    // Filtrar destino para excluir origen
    const idSucursal = this.lotes.find(l => l.idLote === this.movimientoForm.get('idLote')?.value)?.idSucursal;
    if (idSucursal) {
      this.ubicacionService.obtener_ubicacionesPrioridad_sucursal(idSucursal).subscribe({
        next: (ubicaciones: any) => {
          const ubicacionesData = Array.isArray(ubicaciones) ? ubicaciones : (ubicaciones.data || []);
          this.ubicacionesDestino = ubicacionesData.filter((u: any) => u.idUbicacion !== idUbicacionOrigen);
          this.actualizarEstadoControles();
        }
      });
    } else {
      this.actualizarEstadoControles();
    }
  }

  /**
   * Valida que la cantidad no exceda el stock disponible
   */
  validarCantidad(): void {
    const cantidad = this.movimientoForm.get('cantidad')?.value || 0;
    if (cantidad > this.stockDisponibleOrigen) {
      this.movimientoForm.patchValue({ cantidad: this.stockDisponibleOrigen });
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: `La cantidad máxima disponible es ${this.stockDisponibleOrigen}`,
        position: 'topRight'
      });
    }
  }

  /**
   * Ejecuta el traslado de stock entre ubicaciones
   */
  ejecutarMovimiento(): void {
    if (this.movimientoForm.invalid) {
      this.marcarCamposComoTocados();
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    const { idLote, idUbicacionOrigen, idUbicacionDestino, cantidad } = this.movimientoForm.getRawValue();

    // Validar que origen y destino sean diferentes
    if (idUbicacionOrigen === idUbicacionDestino) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'La ubicación origen y destino deben ser diferentes',
        position: 'topRight'
      });
      return;
    }

    // Validar stock disponible
    if (cantidad > this.stockDisponibleOrigen) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: `No hay suficiente stock. Disponible: ${this.stockDisponibleOrigen}`,
        position: 'topRight'
      });
      return;
    }

    this.ejecutando = true;
    this.actualizarEstadoControles();

    // 1. Restar de origen
    const datosOrigen = {
      idLote,
      idUbicacion: idUbicacionOrigen,
      cantidad: -cantidad // Negativo para restar
    };

    this.loteUbicacionService.actualizar_cantidad_loteUbicacion(datosOrigen).subscribe({
      next: () => {
        // 2. Sumar a destino (crear si no existe)
        this.loteUbicacionService.crear_loteUbicacion({
          idLote,
          idUbicacion: idUbicacionDestino,
          cantidad
        }).subscribe({
          next: () => {
            this.ejecutando = false;
            iziToast.show({
              title: 'Éxito',
              titleColor: '#28a745',
              message: `Movimiento de ${cantidad} unidades ejecutado correctamente`,
              position: 'topRight'
            });
            this.activeModal.close({ success: true, cantidad, idLote });
          },
          error: (error) => {
            this.ejecutando = false;
            this.actualizarEstadoControles();
            console.error('Error en destino:', error);
            // Intentar revertir el movimiento en origen
            this.loteUbicacionService.actualizar_cantidad_loteUbicacion({
              idLote,
              idUbicacion: idUbicacionOrigen,
              cantidad: cantidad // Positivo para sumar de vuelta
            }).subscribe();
            
            iziToast.show({
              title: 'Error',
              titleColor: '#dc3545',
              message: error.error?.message || 'Error al mover stock a destino',
              position: 'topRight'
            });
          }
        });
      },
      error: (error) => {
        this.ejecutando = false;
        this.actualizarEstadoControles();
        console.error('Error en origen:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al restar stock del origen',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Marca todos los campos como tocados
   */
  private marcarCamposComoTocados(): void {
    Object.keys(this.movimientoForm.controls).forEach(key => {
      this.movimientoForm.get(key)?.markAsTouched();
    });
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.movimientoForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  /**
   * Actualiza el estado disabled de los controles según el estado del formulario
   * (evita usar [disabled] en template con reactive forms)
   */
  actualizarEstadoControles(): void {
    const idOrigen = this.movimientoForm.get('idUbicacionOrigen')?.value;
    const cIdLote = this.movimientoForm.get('idLote');
    const cOrigen = this.movimientoForm.get('idUbicacionOrigen');
    const cDestino = this.movimientoForm.get('idUbicacionDestino');
    const cCantidad = this.movimientoForm.get('cantidad');
    if (this.ejecutando) {
      cIdLote?.disable();
      cOrigen?.disable();
      cDestino?.disable();
      cCantidad?.disable();
    } else {
      cIdLote?.enable();
      cOrigen?.enable();
      cDestino?.enable();
      cCantidad?.enable();
      if (this.ubicacionesOrigen.length === 0) cOrigen?.disable();
      if (this.ubicacionesDestino.length === 0 || !idOrigen) cDestino?.disable();
      if (this.stockDisponibleOrigen === 0) cCantidad?.disable();
    }
  }

  /**
   * Código de la ubicación origen seleccionada (para el resumen en template)
   */
  get codigoUbicacionOrigen(): string {
    const id = this.movimientoForm.get('idUbicacionOrigen')?.value;
    const u = this.ubicacionesOrigen.find((u: any) => u.idUbicacion === id);
    return u?.codigoUbicacion ?? '';
  }

  /**
   * Código de la ubicación destino seleccionada (para el resumen en template)
   */
  get codigoUbicacionDestino(): string {
    const id = this.movimientoForm.get('idUbicacionDestino')?.value;
    const u = this.ubicacionesDestino.find((u: any) => u.idUbicacion === id);
    return u?.codigoUbicacion ?? '';
  }

  /**
   * Cierra el modal
   */
  cancelar(): void {
    this.activeModal.dismiss();
  }
}
