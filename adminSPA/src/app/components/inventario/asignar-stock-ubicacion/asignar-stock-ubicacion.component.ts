import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { LotesService } from '../../../services/lotes.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

declare var iziToast: any;

@Component({
  selector: 'app-asignar-stock-ubicacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  asignaciones: { idUbicacion: number, cantidad: number, codigoUbicacion: string, prioridad: number }[] = [];
  
  // Cantidad restante por asignar
  cantidadRestante = 0;
  
  // Estados de carga
  cargandoLote = true;
  cargandoUbicaciones = false;
  guardando = false;
  
  // Información del lote
  infoLote: any = null;
  idSucursal: string = '';

  constructor(
    public activeModal: NgbActiveModal,
    private ubicacionService: UbicacionPrioridadService,
    private loteUbicacionService: LotesUbicacionService,
    private loteService: LotesService
  ) {}

  ngOnInit(): void {
    this.cantidadRestante = this.cantidadTotal;
    this.cargarDatosLote();
  }

  /**
   * Carga datos del lote para obtener idSucursal
   */
  cargarDatosLote(): void {
    this.cargandoLote = true;
    this.loteService.obtener_lote_id(this.idLote).subscribe({
      next: (response: any) => {
        this.infoLote = response.data || response;
        this.idSucursal = this.infoLote.idSucursal;
        this.cargandoLote = false;
        this.cargarUbicaciones();
      },
      error: (error) => {
        console.error('Error cargando lote:', error);
        this.cargandoLote = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'No se pudo cargar la información del lote',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Carga ubicaciones de la sucursal del lote
   */
  cargarUbicaciones(): void {
    if (!this.idSucursal) {
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: 'No se pudo determinar la sucursal del lote',
        position: 'topRight'
      });
      return;
    }

    this.cargandoUbicaciones = true;
    this.ubicacionService.obtener_ubicacionesPrioridad_sucursal(this.idSucursal).subscribe({
      next: (data: any) => {
        this.ubicaciones = Array.isArray(data) ? data : (data.data || []);
        this.inicializarAsignaciones();
        this.cargandoUbicaciones = false;
        
        if (this.ubicaciones.length === 0) {
          iziToast.show({
            title: 'Advertencia',
            titleColor: '#ffc107',
            message: 'No hay ubicaciones configuradas para esta sucursal. Configure ubicaciones primero.',
            position: 'topRight'
          });
        }
      },
      error: (error) => {
        console.error('Error cargando ubicaciones:', error);
        this.cargandoUbicaciones = false;
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: 'Error al cargar las ubicaciones',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Inicializa array de asignaciones con 0 en cada ubicación
   */
  inicializarAsignaciones(): void {
    // Ordenar por prioridad (menor número = mayor prioridad)
    const ubicacionesOrdenadas = [...this.ubicaciones].sort((a, b) => 
      (a.prioridad || 999) - (b.prioridad || 999)
    );

    this.asignaciones = ubicacionesOrdenadas.map(u => ({
      idUbicacion: u.idUbicacion!,
      codigoUbicacion: u.codigoUbicacion,
      prioridad: u.prioridad || 999,
      cantidad: 0
    }));
  }

  /**
   * Calcula cantidad restante en tiempo real
   */
  calcularRestante(): void {
    const totalAsignado = this.asignaciones.reduce((sum, a) => sum + (Number(a.cantidad) || 0), 0);
    this.cantidadRestante = this.cantidadTotal - totalAsignado;
  }

  /**
   * Valida que la cantidad ingresada no exceda lo disponible
   */
  validarCantidad(asignacion: any, event: any): void {
    const valor = Number(event.target.value) || 0;
    const totalAsignado = this.asignaciones.reduce((sum, a) => {
      if (a.idUbicacion === asignacion.idUbicacion) {
        return sum;
      }
      return sum + (Number(a.cantidad) || 0);
    }, 0);
    
    const disponible = this.cantidadTotal - totalAsignado;
    
    if (valor > disponible) {
      event.target.value = disponible;
      asignacion.cantidad = disponible;
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: `La cantidad máxima disponible es ${disponible}`,
        position: 'topRight'
      });
    }
    
    this.calcularRestante();
  }

  /**
   * Distribuye automáticamente el stock restante en la primera ubicación disponible
   */
  distribuirAutomatico(): void {
    if (this.cantidadRestante <= 0) return;
    
    // Buscar primera ubicación sin asignar o con menor cantidad
    const primeraUbicacion = this.asignaciones.find(a => a.cantidad === 0) || this.asignaciones[0];
    if (primeraUbicacion) {
      primeraUbicacion.cantidad = this.cantidadRestante;
      this.calcularRestante();
    }
  }

  /**
   * Guarda asignaciones del stock a ubicaciones
   */
  guardarAsignacion(): void {
    // Validaciones
    if (this.cantidadRestante !== 0) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: `Debe asignar todas las unidades. Restan ${this.cantidadRestante} unidades por asignar`,
        position: 'topRight'
      });
      return;
    }

    // Filtra solo ubicaciones con cantidad > 0
    const asignacionesValidas = this.asignaciones.filter(a => a.cantidad > 0);
    
    if (asignacionesValidas.length === 0) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Debe asignar al menos una unidad a alguna ubicación',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;

    // Crea todas las asignaciones usando forkJoin
    const observables = asignacionesValidas.map(a => 
      this.loteUbicacionService.crear_loteUbicacion({
        idLote: this.idLote,
        idUbicacion: a.idUbicacion,
        cantidad: a.cantidad
      })
    );

    forkJoin(observables).subscribe({
      next: () => {
        this.guardando = false;
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: `Stock asignado correctamente a ${asignacionesValidas.length} ubicación(es)`,
          position: 'topRight'
        });
        this.activeModal.close({ success: true, asignaciones: asignacionesValidas.length });
      },
      error: (error) => {
        this.guardando = false;
        console.error('Error guardando asignaciones:', error);
        iziToast.show({
          title: 'Error',
          titleColor: '#dc3545',
          message: error.error?.message || 'Error al guardar las asignaciones',
          position: 'topRight'
        });
      }
    });
  }

  /**
   * Cierra el modal sin guardar
   */
  cancelar(): void {
    this.activeModal.dismiss();
  }
}
