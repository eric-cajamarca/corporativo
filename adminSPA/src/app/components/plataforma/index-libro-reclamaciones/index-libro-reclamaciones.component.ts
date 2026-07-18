import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { LibroReclamacionesService } from '../../../services/libro-reclamaciones.service';
import {
  LibroReclamacionDetalle,
  LibroReclamacionListItem
} from '../../../models/libro-reclamaciones.models';

declare var iziToast: any;

@Component({
  selector: 'app-index-libro-reclamaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './index-libro-reclamaciones.component.html',
  styleUrl: './index-libro-reclamaciones.component.css'
})
export class IndexLibroReclamacionesComponent implements OnInit {
  loading = signal(true);
  items = signal<LibroReclamacionListItem[]>([]);
  filtroEstado = '';
  seleccion = signal<LibroReclamacionDetalle | null>(null);
  respuesta = '';
  estadoRespuesta = 'RESPONDIDO';
  guardando = signal(false);

  constructor(
    private libroService: LibroReclamacionesService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.libroService.listar(this.filtroEstado || undefined).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.items.set([]);
        this.loading.set(false);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudo cargar el libro de reclamaciones',
            position: 'topRight'
          });
        }
      }
    });
  }

  abrirDetalle(item: LibroReclamacionListItem): void {
    this.respuesta = '';
    this.estadoRespuesta = 'RESPONDIDO';
    this.libroService.obtener(item.idReclamacion).subscribe({
      next: (data) => {
        this.seleccion.set(data);
        this.respuesta = data.respuestaProveedor || '';
        if (data.estado === 'EN_PROCESO' || data.estado === 'CERRADO') {
          this.estadoRespuesta = data.estado;
        }
      },
      error: (err) => {
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudo abrir la hoja',
            position: 'topRight'
          });
        }
      }
    });
  }

  cerrarDetalle(): void {
    this.seleccion.set(null);
  }

  enviarRespuesta(): void {
    const actual = this.seleccion();
    if (!actual) return;
    const texto = this.respuesta.trim();
    if (texto.length < 5) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({
          title: 'Atención',
          message: 'Escriba una respuesta (mínimo 5 caracteres)',
          position: 'topRight'
        });
      }
      return;
    }

    this.guardando.set(true);
    this.libroService
      .responder(actual.idReclamacion, {
        respuestaProveedor: texto,
        estado: this.estadoRespuesta
      })
      .subscribe({
        next: (data) => {
          this.guardando.set(false);
          this.seleccion.set(data);
          this.cargar();
          if (typeof iziToast !== 'undefined') {
            iziToast.success({
              title: 'OK',
              message: 'Respuesta registrada y notificada al consumidor',
              position: 'topRight'
            });
          }
        },
        error: (err) => {
          this.guardando.set(false);
          if (typeof iziToast !== 'undefined') {
            iziToast.error({
              title: 'Error',
              message: err?.error?.message || 'No se pudo guardar la respuesta',
              position: 'topRight'
            });
          }
        }
      });
  }

  badgeClass(estado: string): string {
    switch (estado) {
      case 'PENDIENTE':
        return 'bg-warning text-dark';
      case 'EN_PROCESO':
        return 'bg-info text-dark';
      case 'RESPONDIDO':
        return 'bg-success';
      case 'CERRADO':
        return 'bg-secondary';
      default:
        return 'bg-light text-dark';
    }
  }
}
