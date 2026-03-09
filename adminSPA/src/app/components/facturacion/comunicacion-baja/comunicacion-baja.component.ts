import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturacionService, ComprobanteParaBaja, MotivoBaja } from '../../../services/facturacion.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

@Component({
  selector: 'app-comunicacion-baja',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, TopnavComponent],
  templateUrl: './comunicacion-baja.component.html',
  styleUrl: './comunicacion-baja.component.css'
})
export class ComunicacionBajaComponent implements OnInit {

  sidebarState = inject(SidebarStateService);
  comprobantes: ComprobanteParaBaja[] = [];
  motivos: MotivoBaja[] = [];
  /** IDs seleccionados para dar de baja */
  seleccionados: Set<string> = new Set();
  /** Motivo por comprobante (idComprobante -> descripcion) */
  motivoPorComprobante: Record<string, string> = {};
  motivoDefault = '01';
  loadingComprobantes = false;
  enviando = false;
  listado: any[] = [];
  totalListado = 0;
  fechaDesde = '';
  fechaHasta = '';
  idEstadoSunat: number | null = null;
  pagina = 1;
  porPagina = 20;
  consultandoId: string | null = null;

  constructor(private _facturacionService: FacturacionService) {}

  ngOnInit(): void {
    this.establecerRangoMes();
    this.cargarComprobantes();
    this.cargarMotivos();
    this.cargarListado();
  }

  establecerRangoMes(): void {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaDesde = primerDia.toISOString().slice(0, 10);
    this.fechaHasta = hoy.toISOString().slice(0, 10);
  }

  cargarComprobantes(): void {
    this.loadingComprobantes = true;
    this._facturacionService.listarComprobantesParaBaja().subscribe({
      next: (res) => {
        this.comprobantes = res?.data ?? [];
        this.loadingComprobantes = false;
      },
      error: () => {
        this.loadingComprobantes = false;
        this.comprobantes = [];
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los comprobantes.' });
        }
      }
    });
  }

  cargarMotivos(): void {
    this._facturacionService.listarMotivosBaja().subscribe({
      next: (res) => {
        this.motivos = res?.data ?? [];
        if (this.motivos.length > 0 && !this.motivoDefault) {
          this.motivoDefault = this.motivos[0].codigoSunat;
        }
      },
      error: () => {
        this.motivos = [];
      }
    });
  }

  cargarListado(): void {
    this._facturacionService.listarComunicacionesBaja({
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined,
      idEstadoSunat: this.idEstadoSunat ?? undefined,
      pagina: this.pagina,
      porPagina: this.porPagina
    }).subscribe({
      next: (res) => {
        this.listado = res?.data ?? [];
        this.totalListado = res?.total ?? 0;
      },
      error: () => {
        this.listado = [];
        this.totalListado = 0;
      }
    });
  }

  toggleSeleccion(id: string): void {
    if (this.seleccionados.has(id)) {
      this.seleccionados.delete(id);
      delete this.motivoPorComprobante[id];
    } else {
      this.seleccionados.add(id);
      const desc = this.motivos.find(m => m.codigoSunat === this.motivoDefault)?.descripcion || 'Anulación de la operación';
      this.motivoPorComprobante[id] = desc;
    }
    this.seleccionados = new Set(this.seleccionados);
  }

  estaSeleccionado(id: string): boolean {
    return this.seleccionados.has(id);
  }

  get descripcionMotivoDefault(): string {
    return this.motivos.find(m => m.codigoSunat === this.motivoDefault)?.descripcion || 'Anulación de la operación';
  }

  enviarBaja(): void {
    if (this.seleccionados.size === 0) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Selección', message: 'Seleccione al menos un comprobante a dar de baja.' });
      }
      return;
    }
    const comprobantes = Array.from(this.seleccionados).map(id => ({
      idComprobanteElectronico: id,
      motivoBaja: this.motivoPorComprobante[id] || this.descripcionMotivoDefault
    }));
    this.enviando = true;
    this._facturacionService.enviarComunicacionBaja(comprobantes).subscribe({
      next: (res) => {
        this.enviando = false;
        this.seleccionados = new Set();
        this.motivoPorComprobante = {};
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Enviado', message: res?.message ?? 'Comunicación de baja enviada. Consulte el estado.' });
        }
        this.cargarComprobantes();
        this.cargarListado();
      },
      error: (err) => {
        this.enviando = false;
        const msg = err?.error?.message || err?.message || 'Error al enviar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  consultarEstado(item: any): void {
    const id = item?.idComunicacionBaja;
    if (!id) return;
    this.consultandoId = id;
    this._facturacionService.consultarEstadoComunicacionBaja(id).subscribe({
      next: (res) => {
        this.consultandoId = null;
        if (typeof iziToast !== 'undefined') {
          iziToast.info({ title: 'Estado', message: res?.mensaje ?? 'Consultado.' });
        }
        this.cargarListado();
        this.cargarComprobantes();
      },
      error: (err) => {
        this.consultandoId = null;
        const msg = err?.error?.message || err?.message || 'Error al consultar.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
        this.cargarListado();
      }
    });
  }

  tipoDocLabel(tipo: string): string {
    if (tipo === '01') return 'Factura';
    if (tipo === '07') return 'NC';
    if (tipo === '08') return 'ND';
    return tipo;
  }

  descripcionEstado(item: any): string {
    if (item?.descripcionEstadoSunat) return item.descripcionEstadoSunat;
    if (item?.idEstadoSunat == null) return 'Pendiente de consulta';
    return 'Estado ' + item.idEstadoSunat;
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
