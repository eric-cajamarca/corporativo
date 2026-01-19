import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { LotesService } from '../../../services/lotes.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-movimiento-ubicacion',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './movimiento-ubicacion.component.html',
  styleUrl: './movimiento-ubicacion.component.css'
})
export class MovimientoUbicacionComponent {

   // Formulario para el traslado
  movimientoForm: FormGroup;
  
  // Lista de lotes disponibles
  lotes: any[] = [];
  
  // Ubicaciones origen y destino
  ubicacionesOrigen: any[] = [];
  ubicacionesDestino: any[] = [];

  constructor(
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
  }

  /**
   * Carga todos los lotes de la empresa
   */
  cargarLotes(): void {
    this.loteService.obtener_lotes_todos().subscribe({
      next: (data) => {
        this.lotes = data;
      },
      error: (error) => console.error('Error cargando lotes', error)
    });
  }

  /**
   * Cuando seleccionan un lote, carga sus ubicaciones actuales
   */
  onLoteSeleccionado(): void {
    const idLote = this.movimientoForm.get('idLote')?.value;
    if (!idLote) return;

    this.loteUbicacionService.obtener_ubicacionLote_idLote(idLote).subscribe({
      next: (data) => {
        this.ubicacionesOrigen = data;
        // Para destino, carga todas las ubicaciones de la sucursal del lote
        const idSucursal = this.lotes.find(l => l.idLote === idLote)?.idSucursal;
        if (idSucursal) {
          this.ubicacionService.obtener_ubicacionesPrioridad_sucursal(idSucursal).subscribe({
            next: (ubicaciones) => {
              this.ubicacionesDestino = ubicaciones;
            }
          });
        }
      },
      error: (error) => console.error('Error cargando ubicaciones', error)
    });
  }

  /**
   * Ejecuta el traslado de stock entre ubicaciones
   */
  ejecutarMovimiento(): void {
    if (this.movimientoForm.invalid) {
      alert('Complete todos los campos');
      return;
    }

    const { idLote, idUbicacionOrigen, idUbicacionDestino, cantidad } = this.movimientoForm.value;

    const datosOrigen = {
      idLote,
      idUbicacionOrigen,
      cantidad
    };


    // 1. Restar de origen
    this.loteUbicacionService.actualizar_cantidad_loteUbicacion(datosOrigen).subscribe({
      next: () => {
        // 2. Sumar a destino (crear si no existe)
        this.loteUbicacionService.crear_loteUbicacion({
          idLote,
          idUbicacion: idUbicacionDestino,
          cantidad
        }).subscribe({
          next: () => {
            alert('Movimiento ejecutado correctamente');
            this.movimientoForm.reset();
          },
          error: (error) => alert('Error en destino: ' + error.message)
        });
      },
      error: (error) => alert('Error en origen: ' + error.message)
    });
  }
}
