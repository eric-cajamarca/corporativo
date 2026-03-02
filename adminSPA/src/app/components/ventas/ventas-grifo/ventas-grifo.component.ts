import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { GrifoService, type TanqueGrifo, type ResumenGrifo, type ProductoCombustible } from '../../../services/grifo.service';
import { SucursalService } from '../../../services/sucursal.service';

@Component({
  selector: 'app-ventas-grifo',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SidebarComponent,
    TopnavComponent
  ],
  templateUrl: './ventas-grifo.component.html',
  styleUrl: './ventas-grifo.component.css'
})
export class VentasGrifoComponent implements OnInit {
  private grifoService = inject(GrifoService);
  private sucursalService = inject(SucursalService);
  sidebarState = inject(SidebarStateService);

  tanques: TanqueGrifo[] = [];
  resumen: ResumenGrifo | null = null;
  loading = signal(false);
  errorMessage = signal<string | null>(null);

  /** Productos con categoría Combustibles (para configurar tanques) */
  productosCombustibles: ProductoCombustible[] = [];
  sucursales: { idSucursal: string; codigo?: string; nombre?: string }[] = [];

  /** Modal editar lectura tanque */
  showModalTanque = signal(false);
  tanqueEditando: TanqueGrifo | null = null;
  formTanque = { cantidadActual: 0, capacidad: 0 };
  guardandoTanque = false;

  /** Modal crear tanque */
  showModalNuevoTanque = signal(false);
  formNuevoTanque = { idProducto: '', idSucursal: '', capacidad: 0, cantidadActual: 0 };
  guardandoNuevoTanque = false;
  loadingCombustibles = false;

  ngOnInit(): void {
    this.cargarDatos();
  }

  /** Indica si el producto ya tiene un tanque configurado */
  tieneTanque(idProducto: string): boolean {
    return this.tanques.some((t) => t.idProducto === idProducto);
  }

  cargarDatos(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.grifoService.listarTanques().subscribe({
      next: (r) => {
        this.tanques = r.data ?? [];
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar tanques');
        this.tanques = [];
        this.loading.set(false);
      }
    });
    this.grifoService.resumen().subscribe({
      next: (r) => { this.resumen = r.data ?? null; },
      error: () => { this.resumen = null; }
    });
  }

  porcentajeTanque(t: TanqueGrifo): number {
    const cap = Number(t.capacidad) || 0;
    if (cap <= 0) return 0;
    const actual = Number(t.cantidadActual) || 0;
    return Math.min(100, Math.round((actual / cap) * 100));
  }

  formatearMoneda(val: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(val ?? 0);
  }

  abrirModalTanque(t: TanqueGrifo): void {
    this.tanqueEditando = t;
    this.formTanque = { cantidadActual: Number(t.cantidadActual) || 0, capacidad: Number(t.capacidad) || 0 };
    this.showModalTanque.set(true);
  }

  cerrarModalTanque(): void {
    this.showModalTanque.set(false);
    this.tanqueEditando = null;
  }

  guardarTanque(): void {
    if (!this.tanqueEditando) return;
    this.guardandoTanque = true;
    this.grifoService.actualizarTanque(this.tanqueEditando.idTanque, {
      cantidadActual: this.formTanque.cantidadActual,
      capacidad: this.formTanque.capacidad
    }).subscribe({
      next: () => {
        this.cargarDatos();
        this.cerrarModalTanque();
        this.guardandoTanque = false;
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al actualizar tanque');
        this.guardandoTanque = false;
      }
    });
  }

  abrirModalNuevoTanque(): void {
    this.formNuevoTanque = { idProducto: '', idSucursal: '', capacidad: 0, cantidadActual: 0 };
    this.errorMessage.set(null);
    this.showModalNuevoTanque.set(true);
    this.loadingCombustibles = true;
    this.grifoService.productosCombustibles().subscribe({
      next: (r) => {
        this.productosCombustibles = r.data ?? [];
        this.loadingCombustibles = false;
      },
      error: () => {
        this.productosCombustibles = [];
        this.loadingCombustibles = false;
      }
    });
    this.sucursalService.obtener_sucursal_idempresa().subscribe({
      next: (r: { data?: { idSucursal: string; codigo?: string; nombre?: string }[] }) => {
        this.sucursales = r.data ?? [];
      }
    });
  }

  cerrarModalNuevoTanque(): void {
    this.showModalNuevoTanque.set(false);
    this.errorMessage.set(null);
  }

  guardarNuevoTanque(): void {
    if (!this.formNuevoTanque.idProducto) {
      this.errorMessage.set('Seleccione un producto combustible.');
      return;
    }
    this.errorMessage.set(null);
    this.guardandoNuevoTanque = true;
    this.grifoService.crearTanque({
      idProducto: this.formNuevoTanque.idProducto,
      idSucursal: this.formNuevoTanque.idSucursal || undefined,
      capacidad: this.formNuevoTanque.capacidad,
      cantidadActual: this.formNuevoTanque.cantidadActual
    }).subscribe({
      next: () => {
        this.cargarDatos();
        this.cerrarModalNuevoTanque();
        this.guardandoNuevoTanque = false;
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al crear tanque');
        this.guardandoNuevoTanque = false;
      }
    });
  }
}
