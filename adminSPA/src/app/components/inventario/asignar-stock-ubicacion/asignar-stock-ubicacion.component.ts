import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { LotesUbicacionService } from '../../../services/lotes-ubicacion.service';
import { LotesService } from '../../../services/lotes.service';
import { ProductoService } from '../../../services/producto.service';
import { StockUbicacionProductoFila } from '../../../models/producto.models';
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
export class AsignarStockUbicacionComponent implements OnInit {

  // Entradas del modal
  @Input() idLote!: string;
  @Input() cantidadTotal!: number;

  // Lista de ubicaciones disponibles para la sucursal
  ubicaciones: any[] = [];
  
  // Distribución del stock entre ubicaciones (existente = ya estaba asignado)
  asignaciones: { idUbicacion: number, cantidad: number, codigoUbicacion: string, prioridad: number, existente?: boolean }[] = [];
  
  // Cantidad restante por asignar
  cantidadRestante = 0;

  /** Stock del producto en la sucursal (todos los lotes); solo informativo */
  stockResumenProducto: StockUbicacionProductoFila[] = [];
  cargandoStockResumen = false;

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
    private loteService: LotesService,
    private productoService: ProductoService
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
        this.idSucursal = (this.infoLote?.idSucursal ?? this.infoLote?.IdSucursal) ?? '';
        const loteQty = Number(this.infoLote?.cantidadDisponible ?? this.infoLote?.CantidadDisponible);
        if (Number.isFinite(loteQty) && loteQty >= 0) {
          this.cantidadTotal = loteQty;
        }
        const idProd = this.infoLote?.idProducto ?? this.infoLote?.IdProducto;
        if (idProd && this.idSucursal) {
          this.cargandoStockResumen = true;
          this.productoService.obtenerStockUbicacionesProducto(String(idProd), String(this.idSucursal)).subscribe({
            next: (r) => {
              this.stockResumenProducto = Array.isArray(r?.data) ? r.data : [];
              this.cargandoStockResumen = false;
            },
            error: () => {
              this.stockResumenProducto = [];
              this.cargandoStockResumen = false;
            }
          });
        } else {
          this.stockResumenProducto = [];
        }
        this.cargandoLote = false;
        this.cargarUbicaciones();
      },
      error: (error) => {
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
   * Carga ubicaciones de la sucursal del lote y luego las asignaciones existentes del lote
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
      next: (response: any) => {
        const raw = response?.data ?? response;
        const arr = Array.isArray(raw) ? raw : [];
        this.ubicaciones = arr.map((u: any) => {
          const idUbicacion = u.idUbicacion ?? u.IdUbicacion;
          const idSucursal = u.idSucursal ?? u.IdSucursal;
          const codigoUbicacion = u.codigoUbicacion ?? u.CodigoUbicacion ?? '';
          const prioridad = u.prioridad ?? u.Prioridad;
          return {
            idUbicacion: idUbicacion != null && idUbicacion !== '' ? Number(idUbicacion) : undefined,
            idSucursal,
            codigoUbicacion: String(codigoUbicacion || ''),
            prioridad: prioridad != null && prioridad !== '' ? Number(prioridad) : 999
          };
        }).filter((u: any) => u.idUbicacion != null && !isNaN(u.idUbicacion));
        this.cargarAsignacionesExistentes();
      },
      error: (error) => {
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
   * Carga asignaciones ya existentes para este lote y mezcla con la lista de ubicaciones
   */
  cargarAsignacionesExistentes(): void {
    this.loteUbicacionService.obtener_ubicacionLote_idLote(this.idLote).subscribe({
      next: (response: any) => {
        const raw = response?.data ?? response;
        const existentes = Array.isArray(raw) ? raw : [];
        this.inicializarAsignaciones(existentes);
        this.cargandoUbicaciones = false;
        if (this.ubicaciones.length === 0 && this.asignaciones.length === 0) {
          iziToast.show({
            title: 'Advertencia',
            titleColor: '#ffc107',
            message: 'No hay ubicaciones configuradas para esta sucursal. Cree una desde Inventario > Ubicaciones.',
            position: 'topRight'
          });
        }
      },
      error: () => {
        this.inicializarAsignaciones([]);
        this.cargandoUbicaciones = false;
      }
    });
  }

  /**
   * Inicializa asignaciones: pre-rellena con las existentes y el resto en 0. cantidadRestante = total - ya asignado.
   */
  inicializarAsignaciones(existentes?: any[]): void {
    const list = existentes ?? [];
    const mapExistente = (list || []).reduce((acc: Record<number, number>, e: any) => {
      const id = e.idUbicacion != null ? Number(e.idUbicacion) : null;
      if (id != null && !isNaN(id)) acc[id] = Number(e.cantidad) || 0;
      return acc;
    }, {});
    const ubicacionesOrdenadas = [...this.ubicaciones].sort((a, b) =>
      (a.prioridad || 999) - (b.prioridad || 999)
    );
    this.asignaciones = ubicacionesOrdenadas
      .filter(u => u.idUbicacion != null && !isNaN(Number(u.idUbicacion)))
      .map(u => {
        const idUbicacion = Number(u.idUbicacion);
        const cantidad = mapExistente[idUbicacion] ?? 0;
        const existente = (mapExistente[idUbicacion] ?? 0) > 0;
        return {
          idUbicacion,
          codigoUbicacion: u.codigoUbicacion || '',
          prioridad: u.prioridad ?? 999,
          cantidad,
          existente
        };
      });
    const totalAsignado = this.asignaciones.reduce((s, a) => s + (Number(a.cantidad) || 0), 0);
    this.cantidadRestante = this.cantidadTotal - totalAsignado;
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
   * Guarda asignaciones: actualiza existentes, crea nuevas, elimina las que quedaron en 0.
   */
  guardarAsignacion(): void {
    if (this.cantidadRestante !== 0) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: `Debe asignar todas las unidades. Restan ${this.cantidadRestante} unidades por asignar`,
        position: 'topRight'
      });
      return;
    }

    const conCantidad = this.asignaciones.filter(a => (Number(a.cantidad) || 0) > 0);
    const aEliminar = this.asignaciones.filter(a => (Number(a.cantidad) || 0) === 0 && a.existente);

    if (conCantidad.length === 0 && aEliminar.length === 0) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Debe asignar al menos una unidad a alguna ubicación',
        position: 'topRight'
      });
      return;
    }

    this.guardando = true;
    const observables: any[] = [];
    conCantidad.forEach(a => {
      if (a.existente) {
        observables.push(this.loteUbicacionService.actualizar_cantidad_loteUbicacion({
          idLote: this.idLote,
          idUbicacion: a.idUbicacion,
          cantidad: Number(a.cantidad) || 0
        }));
      } else {
        observables.push(this.loteUbicacionService.crear_loteUbicacion({
          idLote: this.idLote,
          idUbicacion: a.idUbicacion,
          cantidad: Number(a.cantidad) || 0
        }));
      }
    });
    aEliminar.forEach(a => {
      observables.push(this.loteUbicacionService.eliminar_loteUbicacion(this.idLote, a.idUbicacion));
    });

    if (observables.length === 0) {
      this.guardando = false;
      this.activeModal.close({ success: true, asignaciones: 0 });
      return;
    }

    forkJoin(observables).subscribe({
      next: () => {
        this.guardando = false;
        iziToast.show({
          title: 'Éxito',
          titleColor: '#28a745',
          message: 'Asignaciones guardadas correctamente',
          position: 'topRight'
        });
        this.activeModal.close({ success: true, asignaciones: conCantidad.length });
      },
      error: (error) => {
        this.guardando = false;
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

  /** Recarga lote, ubicaciones y asignaciones sin cerrar el modal (p. ej. tras crear ubicaciones en otra pantalla). */
  actualizarDesdeServidor(): void {
    if (this.guardando) {
      return;
    }
    this.cargarDatosLote();
  }
}
