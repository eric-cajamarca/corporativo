import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FacturacionService } from '../../../services/facturacion.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { formatFechaLocal, getFechaHoyLocal } from '../../../utils/fecha-local.util';

declare var iziToast: any;

@Component({
  selector: 'app-resumenes-diarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumenes-diarios.component.html',
  styleUrl: './resumenes-diarios.component.css'
})
export class ResumenesDiariosComponent implements OnInit {

  public sidebarState: SidebarStateService = inject(SidebarStateService);
  items: any[] = [];
  total = 0;
  loading = false;
  fechaDesde = '';
  fechaHasta = '';
  idEstadoSunat: number | null = null;
  pagina = 1;
  porPagina = 20;

  fechaResumenEnviar = '';
  enviando = false;
  consultandoId: string | null = null;

  /** Boletas/notas pendientes por fecha en el rango (para mostrar aviso). */
  boletasPendientesPorFecha: { fechaResumen: string; cantidad: number }[] = [];

  constructor(
    private _facturacionService: FacturacionService,
    //private sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.establecerRangoMes();
    this.cargar();
  }

  establecerRangoMes(): void {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    this.fechaDesde = formatFechaLocal(primerDia);
    this.fechaHasta = getFechaHoyLocal();
  }

  cargar(): void {
    this.loading = true;
    this._facturacionService.listarResumenesDiarios({
      fechaDesde: this.fechaDesde || undefined,
      fechaHasta: this.fechaHasta || undefined,
      idEstadoSunat: this.idEstadoSunat ?? undefined,
      pagina: this.pagina,
      porPagina: this.porPagina
    }).subscribe({
      next: (res) => {
        this.items = res?.data ?? [];
        this.total = res?.total ?? 0;
        this.loading = false;
        this.cargarBoletasPendientes();
      },
      error: () => {
        this.loading = false;
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: 'No se pudieron cargar los resúmenes.' });
        }
      }
    });
  }

  private cargarBoletasPendientes(): void {
    const fd = this.fechaDesde || '';
    const fh = this.fechaHasta || '';
    if (!fd || !fh) {
      this.boletasPendientesPorFecha = [];
      return;
    }
    this._facturacionService.listarBoletasPendientesPorFecha(fd, fh).subscribe({
      next: (res) => {
        this.boletasPendientesPorFecha = res?.data ?? [];
      },
      error: () => {
        this.boletasPendientesPorFecha = [];
      }
    });
  }

  enviarResumen(): void {
    const fecha = (this.fechaResumenEnviar || '').trim();
    if (!fecha) {
      if (typeof iziToast !== 'undefined') {
        iziToast.warning({ title: 'Fecha', message: 'Seleccione la fecha del resumen a enviar.' });
      }
      return;
    }
    this.enviando = true;
    this._facturacionService.enviarResumenDiario(fecha).subscribe({
      next: (res) => {
        this.enviando = false;
        this.fechaResumenEnviar = '';
        if (typeof iziToast !== 'undefined') {
          iziToast.success({ title: 'Enviado', message: res?.message ?? 'Resumen enviado. Consulte el estado en unos instantes.' });
        }
        this.cargar();
      },
      error: (err) => {
        this.enviando = false;
        const msg = err?.error?.message || err?.message || 'Error al enviar el resumen.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
      }
    });
  }

  consultarEstado(item: any): void {
    const id = item?.idResumenDiarioSunat;
    if (!id) return;
    this.consultandoId = id;
    this._facturacionService.consultarEstadoResumenDiario(id).subscribe({
      next: (res) => {
        this.consultandoId = null;
        if (res?.mensaje && typeof iziToast !== 'undefined') {
          iziToast.info({ title: 'Estado', message: res.mensaje });
        }
        this.cargar();
      },
      error: (err) => {
        this.consultandoId = null;
        const msg = err?.error?.message || err?.message || 'Error al consultar estado.';
        if (typeof iziToast !== 'undefined') {
          iziToast.error({ title: 'Error', message: msg });
        }
        this.cargar();
      }
    });
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
