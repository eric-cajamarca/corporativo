import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EnviosService } from '../../../services/envios.service';
import { Envio } from '../../../interfaces/envios-interface';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare const iziToast: any;

type EstadoNombreEnvio = 'EN_PREPARACION' | 'EN_CAMINO' | 'ENTREGADO' | 'DEVUELTO' | 'NO_ENCONTRADO';

@Component({
  selector: 'app-mis-envios-chofer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mis-envios-chofer.component.html',
  styleUrl: './mis-envios-chofer.component.css'
})
export class MisEnviosChoferComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);
  private enviosService = inject(EnviosService);

  public envios: Envio[] = [];
  public loading = false;

  public estadoIds: Partial<Record<EstadoNombreEnvio, number>> = {};
  public observacionesPorEnvio: Record<string, string> = {};
  public estadosLoading = false;

  ngOnInit(): void {
    this.cargarEstadosEnvio();
    this.cargarMisEnvios();
  }

  private cargarEstadosEnvio(): void {
    this.estadosLoading = true;
    this.enviosService.obtenerEstadosEnvio().subscribe({
      next: (res: any) => {
        const estados = (res?.data || res) as Array<{ idEstado?: number; idEstadoEnvio?: number; nombre?: string }>;
        // Algunos endpoints pueden responder con "idEstado" o "idEstadoEnvio".
        for (const e of estados) {
          const id = e.idEstadoEnvio ?? e.idEstado;
          const nombre = e.nombre as EstadoNombreEnvio;
          if (id && nombre) this.estadoIds[nombre] = Number(id);
        }
      },
      error: () => {
        this.estadoIds = {};
      },
      complete: () => {
        this.estadosLoading = false;
      }
    });
  }

  private cargarMisEnvios(): void {
    this.loading = true;
    this.enviosService.obtenerMisEnvios().subscribe({
      next: (res: any) => {
        this.envios = (res?.data || []) as Envio[];
        this.envios.forEach((e) => (this.observacionesPorEnvio[e.idEnvio] = ''));
      },
      error: (err: any) => {
        if (err?.error?.message) iziToast.error({ title: 'Error', message: err.error.message, position: 'topRight' });
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private async actualizarEstado(idEnvio: string, idEstadoEnvio?: number, observaciones?: string): Promise<void> {
    // `estadoIds` es `Partial`, por lo que puede venir `undefined` si el catálogo no cargó aún.
    if (idEstadoEnvio == null) return;
    this.enviosService
      .actualizarEstadoEnvio({ idEnvio, idEstadoEnvio, observaciones: observaciones?.trim() || undefined })
      .subscribe({
        next: () => {
          iziToast.success({ title: 'OK', message: 'Estado actualizado', position: 'topRight' });
          this.cargarMisEnvios();
        },
        error: (err: any) => {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo actualizar', position: 'topRight' });
        }
      });
  }

  // Botones (nombres según EstadoEnvio)
  cargar(idEnvio: string): void {
    const id = this.estadoIds['EN_PREPARACION'];
    this.actualizarEstado(idEnvio, id, this.observacionesPorEnvio[idEnvio] || undefined);
  }

  enCamino(idEnvio: string): void {
    const id = this.estadoIds['EN_CAMINO'];
    this.actualizarEstado(idEnvio, id, this.observacionesPorEnvio[idEnvio] || undefined);
  }

  entregado(idEnvio: string): void {
    const id = this.estadoIds['ENTREGADO'];
    this.actualizarEstado(idEnvio, id, this.observacionesPorEnvio[idEnvio] || undefined);
  }

  devuelto(idEnvio: string): void {
    const id = this.estadoIds['DEVUELTO'];
    this.actualizarEstado(idEnvio, id, this.observacionesPorEnvio[idEnvio] || undefined);
  }

  noEncontrado(idEnvio: string): void {
    const id = this.estadoIds['NO_ENCONTRADO'];
    this.actualizarEstado(idEnvio, id, this.observacionesPorEnvio[idEnvio] || undefined);
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}

