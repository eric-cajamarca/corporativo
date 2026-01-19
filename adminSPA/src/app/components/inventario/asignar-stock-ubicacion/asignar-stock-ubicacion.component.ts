import { Component, Input, NgModule } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-asignar-stock-ubicacion',
  standalone: true,
  imports: [TopnavComponent, CommonModule, FormsModule],
  templateUrl: './asignar-stock-ubicacion.component.html',
  styleUrl: './asignar-stock-ubicacion.component.css'
})
export class AsignarStockUbicacionComponent {

  // Entradas del modal
  @Input() idLote!: string;
  @Input() cantidadTotal!: number;

  // Lista de ubicaciones disponibles para la sucursal
  ubicaciones: any[] = [];
  
  // Distribución del stock entre ubicaciones
  asignaciones: { idUbicacion: number, cantidad: number, codigoUbicacion: string }[] = [];
  
  // Cantidad restante por asignar
  cantidadRestante = 0;

  constructor(
    public activeModal: NgbActiveModal,
    private ubicacionService: UbicacionPrioridadService,
    private loteUbicacionService: LotesUbicacionService
  ) {}

  ngOnInit(): void {
    console.log('Asignar stock para lote', this.idLote, 'Cantidad total:', this.cantidadTotal);
    this.cargarUbicaciones();
    this.cantidadRestante = this.cantidadTotal;
  }

  /**
   * Carga ubicaciones de la sucursal del lote
   */
  cargarUbicaciones(): void {
    // Aquí deberías obtener idSucursal del lote actual
    const idSucursal = 'UUID_SUCURSAL'; // Obténlo del lote padre
    
    this.ubicacionService.obtener_ubicacionesPrioridad_sucursal(idSucursal).subscribe({
      next: (data) => {
        this.ubicaciones = data;
        this.inicializarAsignaciones();
      },
      error: (error) => console.error('Error cargando ubicaciones', error)
    });
  }

  /**
   * Inicializa array de asignaciones con 0 en cada ubicación
   */
  inicializarAsignaciones(): void {
    this.asignaciones = this.ubicaciones.map(u => ({
      idUbicacion: u.idUbicacion!,
      codigoUbicacion: u.codigoUbicacion,
      cantidad: 0
    }));
  }

  /**
   * Calcula cantidad restante en tiempo real
   */
  calcularRestante(): void {
    const totalAsignado = this.asignaciones.reduce((sum, a) => sum + (a.cantidad || 0), 0);
    this.cantidadRestante = this.cantidadTotal - totalAsignado;
  }

  /**
   * Guarda asignaciones del stock a ubicaciones
   */
  guardarAsignacion(): void {
    if (this.cantidadRestante !== 0) {
      alert(`Aún quedan ${this.cantidadRestante} unidades por asignar`);
      return;
    }

    // Filtra solo ubicaciones con cantidad > 0
    const asignacionesValidas = this.asignaciones.filter(a => a.cantidad > 0);

    // Crea todas las asignaciones
    const observables = asignacionesValidas.map(a => 
      this.loteUbicacionService.crear_loteUbicacion({
        idLote: this.idLote,
        idUbicacion: a.idUbicacion,
        cantidad: a.cantidad
      })
    );

    // Ejecuta todas las llamadas y cierra modal
    // Usa forkJoin para esperar todas las respuestas
    import('rxjs').then(rxjs => {
      rxjs.forkJoin(observables).subscribe({
        next: () => {
          alert('Asignación guardada correctamente');
          this.activeModal.close('success');
        },
        error: (error) => alert('Error: ' + error.message)
      });
    });
  }
}
