import { Component, inject, signal } from '@angular/core';

declare var iziToast: any;
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { EnviosService } from '../../../services/envios.service';
import { ChoferesService } from '../../../services/choferes.service';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { CajaOperacionContextService } from '../../../services/caja-operacion-context.service';

export interface EnvioProgramado {
  idEnvio: string;
  idEstadoEnvio?: number | null;
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
  private cajaOperacionContext = inject(CajaOperacionContextService);
  public enviosProgramados: EnvioProgramado[] = [];
  public loading = true;
  public estadosEnvio: Array<{ idEstadoEnvio: number; nombre: string }> = [];
  public filtros: {
    idEstadoEnvio?: number;
    fechaDesde?: string;
    fechaHasta?: string;
    ruc?: string;
    cliente?: string;
    idEmpresa?: string;
  } = {};

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
  /** idEnvio cuyo estado se está actualizando desde la tarjeta */
  actualizandoEstadoEnvio = signal<string | null>(null);

  constructor(
    private _enviosService: EnviosService,
    private _choferesService: ChoferesService,
    private _router: Router
  ) { }

  /** Nombre de estado de la tarjeta (API) normalizado para comparar con catálogo. */
  private nombreEstadoTarjeta(envio: EnvioProgramado): string {
    return (envio.estadoActual || '').trim().toUpperCase().replace(/\s+/g, '_');
  }

  esEstadoAgendado(envio: EnvioProgramado): boolean {
    return this.nombreEstadoTarjeta(envio) === 'AGENDADO';
  }

  /** Oculta AGENDADO en el combo salvo que el envío ya esté en AGENDADO (no se vuelve atrás manualmente). */
  estadosOpcionesCard(envio: EnvioProgramado): Array<{ idEstadoEnvio: number; nombre: string }> {
    const cur = this.nombreEstadoTarjeta(envio);
    return this.estadosEnvio.filter((ee) => {
      const n = (ee.nombre || '').trim().toUpperCase().replace(/\s+/g, '_');
      if (n === 'AGENDADO' && cur !== 'AGENDADO') return false;
      return true;
    });
  }

  irADespachos(envio: EnvioProgramado): void {
    const comp = (envio.comprobante || '').trim();
    if (!comp || comp === '—' || comp === '-') {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Sin comprobante', message: 'No hay número de comprobante para buscar en despachos.', position: 'topRight' });
      }
      return;
    }
    this._router.navigate(['/despachos'], { queryParams: { compVenta: comp } });
  }

  ngOnInit(): void {
    this.cajaOperacionContext.cargarContexto().subscribe({
      next: () => {
        this.refrescarCatalogosEdicion();
        this.cargarEnvios();
      },
      error: () => {
        this.refrescarCatalogosEdicion();
        this.cargarEnvios();
      }
    });
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
  }

  /**
   * Catálogo choferes/transportistas: si el usuario tiene varias empresas en contexto (gestora),
   * siempre listado consolidado aunque en caja tenga seleccionada una gestionada (los envíos pueden usar chofer de otra vinculada).
   */
  private refrescarCatalogosEdicion(): void {
    this.refrescarCatalogosEdicion$().subscribe({ error: () => {} });
  }

  private refrescarCatalogosEdicion$() {
    const idEmp = this.cajaOperacionContext.idEmpresaOperacion?.trim() || undefined;
    const empresasCtx = this.cajaOperacionContext.empresasOperacion || [];
    const usarConsolidadoGestora = empresasCtx.length > 1;
    const choferes$ = usarConsolidadoGestora
      ? this._choferesService.listarChoferes(undefined, { alcanceGestora: true })
      : this._choferesService.listarChoferes(idEmp);
    const transportistas$ = usarConsolidadoGestora
      ? this._enviosService.obtenerTransportistas()
      : this._enviosService.obtenerTransportistas(idEmp);
    return forkJoin({ ch: choferes$, tr: transportistas$ }).pipe(
      map(({ ch, tr }) => {
        this.choferes = (ch?.data || []).map((c: any) => ({
          idChofer: c.idChofer,
          nombres: c.nombres,
          apellidos: c.apellidos,
          placa: c.placa
        }));
        this.transportistas = (tr?.data || []).map((t: any) => ({
          idTransportista: t.idTransportista,
          nombres: t.nombres,
          apellidos: t.apellidos
        }));
        return void 0;
      })
    );
  }

  /** Comparación insensible a mayúsculas para selects con UUID */
  compararIdsUuid(a: unknown, b: unknown): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  }

  cargarEnvios(): void {
    this.loading = true;
    const idOp = this.cajaOperacionContext.idEmpresaOperacion?.trim();
    const filtrosReq = { ...this.filtros };
    if (idOp) {
      filtrosReq.idEmpresa = idOp;
    } else {
      delete filtrosReq.idEmpresa;
    }
    this._enviosService.obtenerEnviosProgramados(filtrosReq).subscribe({
      next: (response: any) => {
        const raw = response?.data || [];
        this.enviosProgramados = raw.map((e: any) => ({
          idEnvio: e.idEnvio,
          idEstadoEnvio: e.idEstadoEnvio != null ? Number(e.idEstadoEnvio) : null,
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
      error: (err: any) => {
        this.enviosProgramados = [];
        this.loading = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({
            title: 'No se pudo cargar envíos',
            message: err?.error?.message || err?.message || 'Revise permisos VER_ENVIOS o el servidor.',
            position: 'topRight'
          });
        }
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
    const rawFp = envio.fechaProgramada ? String(envio.fechaProgramada).trim() : '';
    const fp =
      rawFp.length >= 16
        ? rawFp.replace(' ', 'T').slice(0, 16)
        : '';
    this.refrescarCatalogosEdicion$().subscribe({
      next: () => {
        this.editForm = {
          fechaProgramada: fp,
          direccionEntrega: envio.direccionEntrega === '—' ? '' : envio.direccionEntrega || '',
          idChofer: envio.idChofer || null,
          idTransportista: envio.idTransportista || null,
          contactoDestinatario: (envio.contactoDestinatario || '').trim(),
          telefonoDestinatario: (envio.telefonoDestinatario || '').trim(),
          observaciones: (envio.observaciones || '').trim()
        };
        this.modalEditarVisible = true;
      },
      error: () => {
        this.editForm = {
          fechaProgramada: fp,
          direccionEntrega: envio.direccionEntrega === '—' ? '' : envio.direccionEntrega || '',
          idChofer: envio.idChofer || null,
          idTransportista: envio.idTransportista || null,
          contactoDestinatario: (envio.contactoDestinatario || '').trim(),
          telefonoDestinatario: (envio.telefonoDestinatario || '').trim(),
          observaciones: (envio.observaciones || '').trim()
        };
        this.modalEditarVisible = true;
      }
    });
  }

  cambiarEstadoDesdeCard(envio: EnvioProgramado, idEstadoEnvio: number): void {
    if (!envio?.idEnvio || idEstadoEnvio == null || Number.isNaN(idEstadoEnvio)) return;
    if (envio.idEstadoEnvio === idEstadoEnvio) return;
    this.actualizandoEstadoEnvio.set(envio.idEnvio);
    this._enviosService
      .actualizarEstadoEnvio({
        idEnvio: envio.idEnvio,
        idEstadoEnvio
      })
      .subscribe({
        next: () => {
          this.actualizandoEstadoEnvio.set(null);
          this.cargarEnvios();
          if (typeof iziToast !== 'undefined') {
            iziToast.success({ title: 'Estado actualizado', position: 'topRight' });
          }
        },
        error: (err: any) => {
          this.actualizandoEstadoEnvio.set(null);
          if (typeof iziToast !== 'undefined') {
            iziToast.error({
              title: 'Error',
              message: err?.error?.message || 'No se pudo cambiar el estado',
              position: 'topRight'
            });
          }
        }
      });
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
    if (!this.esEstadoAgendado(envio)) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({
          title: 'No eliminable',
          message: 'Solo puede eliminar cuando el envío está en AGENDADO (tras devolver toda la mercadería en despachos).',
          position: 'topRight'
        });
      }
      return;
    }
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
