import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { InventarioModalService } from '../../../services/inventario-modal.service';
import { LotesService } from '../../../services/lotes.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;

@Component({
  selector: 'app-principal-inventario',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './principal-inventario.component.html',
  styleUrls: ['./principal-inventario.component.css']
})
export class PrincipalInventarioComponent implements OnInit {
  // Estadísticas
  totalLotes = 0;
  totalStock = 0;
  lotesRecientes: any[] = [];
  cargandoEstadisticas = true;

  constructor(
    public inventarioModal: InventarioModalService,
    private loteService: LotesService,
    public sidebarState: SidebarStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarEstadisticas();
  }

  /**
   * Carga estadísticas de inventario
   */
  cargarEstadisticas(): void {
    this.cargandoEstadisticas = true;
    this.loteService.obtener_lotes_todos().subscribe({
      next: (response: any) => {
        const lotes = response.data || [];
        this.totalLotes = lotes.length;
        this.totalStock = lotes.reduce((sum: number, l: any) => sum + (l.cantidadDisponible || 0), 0);
        this.lotesRecientes = lotes.slice(0, 5); // Últimos 5 lotes
        this.cargandoEstadisticas = false;
      },
      error: (error) => {
        console.error('Error cargando estadísticas:', error);
        this.cargandoEstadisticas = false;
      }
    });
  }

  /** Quita el foco del botón al abrir modal para evitar aviso aria-hidden */
  private blurTrigger(event?: Event): void {
    (event?.target as HTMLElement)?.blur();
  }

  /** Navegación explícita: en algunos móviles los enlaces tipo botón con routerLink no disparan bien el toque. */
  irConteoFisico(event?: Event): void {
    this.blurTrigger(event);
    void this.router.navigateByUrl('/inventario/conteo-fisico').then((ok) => {
      if (!ok) {
        console.error('No se pudo navegar a conteo físico');
      }
    });
  }

  /**
   * Abre modal de asignar ubicaciones
   */
  abrirAsignarUbicaciones(event?: Event): void {
    this.blurTrigger(event);
    this.inventarioModal.abrirLoteList().then(result => {
      if (result) {
        this.cargarEstadisticas();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal de crear lote
   */
  abrirCrearLote(event?: Event): void {
    this.blurTrigger(event);
    this.inventarioModal.abrirLoteForm().then(result => {
      if (result?.success) {
        this.cargarEstadisticas();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal de lista de lotes
   */
  abrirListaLotes(event?: Event): void {
    this.blurTrigger(event);
    this.inventarioModal.abrirLoteList().then(result => {
      if (result) {
        this.cargarEstadisticas();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal de movimiento entre ubicaciones
   */
  abrirMovimientoUbicacion(event?: Event): void {
    this.blurTrigger(event);
    this.inventarioModal.abrirMovimientoUbicacion().then(result => {
      if (result?.success) {
        this.cargarEstadisticas();
      }
    }).catch(() => {});
  }

  /**
   * Abre modal de ubicaciones con prioridad
   */
  abrirUbicacionesPrioridad(event?: Event): void {
    this.blurTrigger(event);
    this.inventarioModal.abrirUbicacionesPrioridad().then(result => {
      if (result?.success) {
        this.cargarEstadisticas();
      }
    }).catch(() => {});
  }

}