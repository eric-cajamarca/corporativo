import { Component, inject, signal } from '@angular/core';

declare var iziToast: any;
import { EnviosService } from '../../../services/envios.service';
import { ChoferesService } from '../../../services/choferes.service';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

export interface EnvioProgramado {
  idEnvio: string;
  idChofer?: string | null;
  idTransportista?: string | null;
  FEnvio: string;
  fechaProgramada: string | null;
  comprobante: string;
  cliente: string;
  direccionEntrega: string;
  estadoActual: string;
  colorEstado: string | null;
  tipoEnvio: string;
  chofer: string | null;
  transportista: string | null;
  contactoDestinatario: string | null;
  telefonoDestinatario: string | null;
  observaciones?: string | null;
}

@Component({
  selector: 'app-index-envios',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, SidebarComponent],
  templateUrl: './index-envios.component.html',
  styleUrl: './index-envios.component.css'
})
export class IndexEnviosComponent {

  public sidebarState = inject(SidebarStateService);
  public enviosProgramados: EnvioProgramado[] = [];
  public loading = true;
  public estadosEnvio: Array<{ idEstadoEnvio: number; nombre: string }> = [];
  public filtros: { idEstadoEnvio?: number; fechaDesde?: string; fechaHasta?: string; ruc?: string; cliente?: string } = {};

  modalVerVisible = false;
  modalEditarVisible = false;
  envioSeleccionado: EnvioProgramado | null = null;
  detalleEnvio: any[] = [];
  loadingDetalle = false;

  choferes: Array<{ idChofer: string; nombres: string; apellidos: string; placa?: string }> = [];
  transportistas: Array<{ idTransportista: string; nombres: string; apellidos: string }> = [];
  editForm: {
    fechaProgramada: string;
    direccionEntrega: string;
    idChofer: string | null;
    idTransportista: string | null;
    contactoDestinatario: string;
    telefonoDestinatario: string;
    observaciones: string;
  } = {
    fechaProgramada: '',
    direccionEntrega: '',
    idChofer: null,
    idTransportista: null,
    contactoDestinatario: '',
    telefonoDestinatario: '',
    observaciones: ''
  };
  guardando = false;
  eliminando = signal<string | null>(null);

  constructor(
    private _enviosService: EnviosService,
    private _choferesService: ChoferesService
  ) { }

  ngOnInit(): void {
    this.cargarEnvios();
    this._enviosService.obtenerEstadosEnvio().subscribe({
      next: (res: any) => {
        const raw = res?.data || res || [];
        this.estadosEnvio = raw.map((e: any) => ({
          idEstadoEnvio: e.idEstadoEnvio ?? e.idEstado ?? e.id,
          nombre: e.nombre ?? e.descripcion ?? ''
        })).filter((e: any) => e.idEstadoEnvio && e.nombre);
      },
      error: () => { this.estadosEnvio = []; }
    });
    this._choferesService.listarChoferes().subscribe({
      next: (res: any) => this.choferes = (res?.data || []).map((c: any) => ({
        idChofer: c.idChofer,
        nombres: c.nombres,
        apellidos: c.apellidos,
        placa: c.placa
      })),
      error: () => this.choferes = []
    });
    this._enviosService.obtenerTransportistas().subscribe({
      next: (res: any) => this.transportistas = (res?.data || []).map((t: any) => ({
        idTransportista: t.idTransportista,
        nombres: t.nombres,
        apellidos: t.apellidos
      })),
      error: () => this.transportistas = []
    });
  }

  cargarEnvios(): void {
    this.loading = true;
    this._enviosService.obtenerEnviosProgramados(this.filtros).subscribe({
      next: (response: any) => {
        const raw = response?.data || [];
        this.enviosProgramados = raw.map((e: any) => ({
          idEnvio: e.idEnvio,
          idChofer: e.idChofer || null,
          idTransportista: e.idTransportista || null,
          FEnvio: e.FEnvio,
          fechaProgramada: e.fechaProgramada,
          comprobante: e.comprobante || '—',
          cliente: e.cliente || '—',
          direccionEntrega: e.direccionEntrega || '—',
          estadoActual: e.estadoActual || '—',
          colorEstado: e.colorEstado || null,
          tipoEnvio: e.tipoEnvio || '—',
          chofer: e.chofer || null,
          transportista: e.transportista || null,
          contactoDestinatario: e.contactoDestinatario || null,
          telefonoDestinatario: e.telefonoDestinatario || null,
          observaciones: e.observaciones || null
        }));
        this.loading = false;
      },
      error: () => {
        this.enviosProgramados = [];
        this.loading = false;
      }
    });
  }

  abrirModalVer(envio: EnvioProgramado): void {
    this.envioSeleccionado = envio;
    this.modalVerVisible = true;
    this.detalleEnvio = [];
    this.loadingDetalle = true;
    this._enviosService.obtenerDetalleEnvio(envio.idEnvio).subscribe({
      next: (res: any) => {
        this.detalleEnvio = res?.data || [];
        this.loadingDetalle = false;
      },
      error: () => {
        this.detalleEnvio = [];
        this.loadingDetalle = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudo cargar el detalle', position: 'topRight' });
        }
      }
    });
  }

  cerrarModalVer(): void {
    this.modalVerVisible = false;
    this.envioSeleccionado = null;
    this.detalleEnvio = [];
  }

  abrirModalEditar(envio: EnvioProgramado): void {
    this.envioSeleccionado = envio;
    const fp = envio.fechaProgramada ? String(envio.fechaProgramada).replace('T', ' ').slice(0, 16) : '';
    this.editForm = {
      fechaProgramada: fp,
      direccionEntrega: envio.direccionEntrega || '',
      idChofer: envio.idChofer || null,
      idTransportista: envio.idTransportista || null,
      contactoDestinatario: envio.contactoDestinatario || '',
      telefonoDestinatario: envio.telefonoDestinatario || '',
      observaciones: envio.observaciones || ''
    };
    this.modalEditarVisible = true;
  }

  cerrarModalEditar(): void {
    this.modalEditarVisible = false;
    this.envioSeleccionado = null;
  }

  guardarEdicion(): void {
    if (!this.envioSeleccionado) return;
    this.guardando = true;
    const payload: any = {
      direccionEntrega: this.editForm.direccionEntrega,
      contactoDestinatario: this.editForm.contactoDestinatario || null,
      telefonoDestinatario: this.editForm.telefonoDestinatario || null,
      observaciones: this.editForm.observaciones || null,
      idChofer: this.editForm.idChofer || null,
      idTransportista: this.editForm.idTransportista || null
    };
    if (this.editForm.fechaProgramada) {
      payload.fechaProgramada = this.editForm.fechaProgramada;
    }
    this._enviosService.actualizarEnvio(this.envioSeleccionado.idEnvio, payload).subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModalEditar();
        this.cargarEnvios();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Actualizado', message: 'Envío actualizado correctamente', position: 'topRight' });
        }
      },
      error: (err: any) => {
        this.guardando = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo actualizar', position: 'topRight' });
        }
      }
    });
  }

  confirmarEliminar(envio: EnvioProgramado): void {
    if (!confirm('¿Está seguro de eliminar este envío programado?')) return;
    this.eliminando.set(envio.idEnvio);
    this._enviosService.eliminarEnvio(envio.idEnvio).subscribe({
      next: () => {
        this.eliminando.set(null);
        this.cargarEnvios();
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Eliminado', message: 'Envío eliminado', position: 'topRight' });
        }
      },
      error: (err: any) => {
        this.eliminando.set(null);
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo eliminar', position: 'topRight' });
        }
      }
    });
  }

  buscar(): void {
    this.cargarEnvios();
  }

  limpiarFiltros(): void {
    this.filtros = {};
    this.cargarEnvios();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
