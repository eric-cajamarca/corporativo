import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

export interface ReciboIngresoItem {
  idMovimientoCaja: string;
  idApertura?: string;
  fechaMovimiento: string;
  concepto: string;
  monto: number;
  tipoMovimiento?: string;
  medioPago?: string;
  documentoRelacionado?: string;
  observaciones?: string;
  usuario?: string;
  glosa?: string;
  recibidoDe?: string;
}

@Component({
  selector: 'app-recibo-ingreso',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './recibo-ingreso.component.html',
  styleUrl: './recibo-ingreso.component.css'
})
export class ReciboIngresoComponent implements OnInit {
  list: ReciboIngresoItem[] = [];
  cajas: any[] = [];
  tiposMovimiento: any[] = [];
  conceptos: any[] = [];
  mediosPago: any[] = [];
  loading = false;

  filtros = {
    numero: '',
    buscar: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  mostrarForm = false;
  mostrarVer = false;
  editandoId: string | null = null;
  itemVer: ReciboIngresoItem | null = null;

  form = {
    idApertura: '',
    idTipoMovimientoCaja: 0,
    idConcepto: '' as string,
    concepto: '',
    glosa: '',
    recibidoDe: '',
    importe: 0,
    idMediosPago: null as number | null,
    referencia: '',
    fechaEmision: ''
  };

  serie = '0001';
  numero = '';

  sidebarCollapsed = signal<boolean>(false);

  constructor(
    private cajaService: CajaService,
    private catalogosService: CatalogosService,
    private tablasSunat: TablasSunatService
  ) {}

  ngOnInit(): void {
    const hoy = new Date().toISOString().split('T')[0];
    const hace30 = new Date();
    hace30.setDate(hace30.getDate() - 30);
    this.filtros.fechaDesde = hace30.toISOString().split('T')[0];
    this.filtros.fechaHasta = hoy;
    this.form.fechaEmision = hoy;
    this.cargarDatos();
    this.cargarRecibos();
    this.tiposIngreso();
    this.catalogosService.listarConceptosPorTipo('INGRESO').subscribe({
      next: (r) => { this.conceptos = r.data || []; },
      error: () => {}
    });
    this.tablasSunat.obtener_medios_pago().subscribe({
      next: (r) => { this.mediosPago = r.data || []; },
      error: () => {}
    });
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') this.sidebarCollapsed.set(true);
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  private tiposIngreso(): void {
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (r) => {
        this.tiposMovimiento = (r.data || []).filter((t: any) => t.tipo === 'I');
        if (this.tiposMovimiento.length && !this.form.idTipoMovimientoCaja) {
          this.form.idTipoMovimientoCaja = this.tiposMovimiento[0].idTipoMovimientoCaja;
        }
      },
      error: () => {}
    });
  }

  cargarDatos(): void {
    this.cajaService.obtenerCajas().subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
      },
      error: () => {}
    });
  }

  cargarRecibos(): void {
    this.loading = true;
    const desde = this.filtros.fechaDesde ? this.filtros.fechaDesde + 'T00:00:00' : '';
    const hasta = this.filtros.fechaHasta ? this.filtros.fechaHasta + 'T23:59:59' : '';
    this.cajaService.getRecibosIngreso({ fechaDesde: desde || undefined, fechaHasta: hasta || undefined }).subscribe({
      next: (r) => {
        let data = (r.data || []).map((m: any) => this.mapItem(m));
        if (this.filtros.buscar) {
          const b = this.filtros.buscar.toLowerCase();
          data = data.filter((x: ReciboIngresoItem) =>
            (x.concepto || '').toLowerCase().includes(b) ||
            (x.recibidoDe || '').toLowerCase().includes(b) ||
            (x.glosa || '').toLowerCase().includes(b) ||
            (x.documentoRelacionado || '').toLowerCase().includes(b)
          );
        }
        if (this.filtros.numero) {
          data = data.filter((x: ReciboIngresoItem) => (x.documentoRelacionado || '').includes(this.filtros.numero));
        }
        this.list = data;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private mapItem(m: any): ReciboIngresoItem {
    const obs = (m.observaciones || '').trim();
    let recibidoDe = '';
    let glosa = obs;
    if (obs.includes('|')) {
      const parts = obs.split('|').map((p: string) => p.trim());
      const rec = parts.find((p: string) => p.toLowerCase().startsWith('recibido de:'));
      const g = parts.find((p: string) => p.toLowerCase().startsWith('glosa:'));
      if (rec) recibidoDe = rec.replace(/^recibido de:\s*/i, '').trim();
      if (g) glosa = g.replace(/^glosa:\s*/i, '').trim();
      if (!rec && !g && parts.length >= 2) {
        recibidoDe = parts[0];
        glosa = parts[1];
      }
    }
    const doc = m.documentoRelacionado || ('RI 0001-' + (m.idMovimientoCaja || '').slice(-6));
    return {
      idMovimientoCaja: m.idMovimientoCaja,
      idApertura: m.idApertura,
      fechaMovimiento: m.fechaMovimiento,
      concepto: m.concepto,
      monto: Number(m.monto),
      medioPago: m.medioPago,
      documentoRelacionado: doc,
      observaciones: m.observaciones,
      usuario: m.usuario,
      glosa,
      recibidoDe: recibidoDe || (m.observaciones && !m.observaciones.includes('|') ? m.observaciones : '')
    };
  }

  buscar(): void {
    this.cargarRecibos();
  }

  abrirNuevo(): void {
    this.editandoId = null;
    this.form = {
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      idTipoMovimientoCaja: this.tiposMovimiento.length ? this.tiposMovimiento[0].idTipoMovimientoCaja : 0,
      idConcepto: '',
      concepto: '',
      glosa: '',
      recibidoDe: '',
      importe: 0,
      idMediosPago: null,
      referencia: '',
      fechaEmision: new Date().toISOString().split('T')[0]
    };
    this.numero = '';
    this.serie = '';
    this.mostrarForm = true;
  }

  editar(item: ReciboIngresoItem): void {
    this.editandoId = item.idMovimientoCaja;
    this.form = {
      idApertura: item.idApertura || '',
      idTipoMovimientoCaja: 0,
      idConcepto: (item as any).idConcepto || '',
      concepto: item.concepto,
      glosa: item.glosa || '',
      recibidoDe: item.recibidoDe || '',
      importe: item.monto,
      idMediosPago: null,
      referencia: item.documentoRelacionado || '',
      fechaEmision: item.fechaMovimiento ? item.fechaMovimiento.split('T')[0] : ''
    };
    this.numero = item.documentoRelacionado || '';
    this.mostrarForm = true;
  }

  ver(item: ReciboIngresoItem): void {
    this.itemVer = item;
    this.mostrarVer = true;
  }

  onConceptoChange(idConcepto: string): void {
    if (!idConcepto) return;
    const c = this.conceptos.find((x: any) => x.idConcepto === idConcepto);
    if (c && c.descripcion) this.form.concepto = c.descripcion;
  }

  cerrarForm(): void {
    this.mostrarForm = false;
    this.editandoId = null;
  }

  cerrarVer(): void {
    this.mostrarVer = false;
    this.itemVer = null;
  }

  guardar(): void {
    if (!this.form.concepto.trim() || this.form.importe <= 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Concepto e importe son obligatorios.' });
      return;
    }
    const observaciones = [this.form.recibidoDe ? 'Recibido de: ' + this.form.recibidoDe : '', this.form.glosa ? 'Glosa: ' + this.form.glosa : ''].filter(Boolean).join(' | ');

    if (this.editandoId) {
      this.cajaService.actualizarMovimiento(this.editandoId, {
        concepto: this.form.concepto,
        idConcepto: this.form.idConcepto || undefined,
        monto: this.form.importe,
        idMediosPago: this.form.idMediosPago ?? undefined,
        documentoRelacionado: this.form.referencia || undefined,
        observaciones: observaciones || undefined
      }).subscribe({
        next: () => {
          iziToast.success({ title: 'Éxito', message: 'Recibo actualizado.' });
          this.cerrarForm();
          this.cargarRecibos();
        },
        error: (e) => {
          iziToast.error({ title: 'Error', message: e.error?.message || 'Error al actualizar.' });
        }
      });
      return;
    }

    if (!this.form.idApertura) {
      iziToast.warning({ title: 'Advertencia', message: 'Debe haber una caja abierta para registrar el ingreso.' });
      return;
    }
    if (!this.form.idTipoMovimientoCaja) {
      iziToast.warning({ title: 'Advertencia', message: 'No hay tipo de movimiento Ingreso configurado. Configure TiposMovimientoCaja en la base de datos.' });
      return;
    }
    this.cajaService.registrarMovimientoIngreso({
      idApertura: this.form.idApertura,
      idTipoMovimientoCaja: this.form.idTipoMovimientoCaja,
      concepto: this.form.concepto,
      idConcepto: this.form.idConcepto || undefined,
      monto: this.form.importe,
      idMediosPago: this.form.idMediosPago ?? undefined,
      observaciones: observaciones || undefined
    }).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Recibo de ingreso registrado.' });
        this.cerrarForm();
        this.cargarRecibos();
        this.cargarDatos();
      },
      error: (e) => {
        iziToast.error({ title: 'Error', message: e.error?.message || 'Error al guardar.' });
      }
    });
  }

  eliminar(item: ReciboIngresoItem): void {
    if (!confirm('¿Eliminar este recibo de ingreso?')) return;
    this.cajaService.eliminarMovimiento(item.idMovimientoCaja).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Recibo eliminado.' });
        this.cargarRecibos();
      },
      error: (e) => {
        iziToast.error({ title: 'Error', message: e.error?.message || 'Error al eliminar.' });
      }
    });
  }

  imprimir(item: ReciboIngresoItem): void {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head><title>Recibo Ingreso ${item.documentoRelacionado || ''}</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>Recibo de Ingreso</h2>
        <p><b>Documento:</b> ${item.documentoRelacionado || '-'}</p>
        <p><b>Fecha:</b> ${this.formatFecha(item.fechaMovimiento)}</p>
        <p><b>Concepto:</b> ${item.concepto}</p>
        <p><b>Glosa:</b> ${item.glosa || '-'}</p>
        <p><b>Recibido de:</b> ${item.recibidoDe || '-'}</p>
        <p><b>Importe:</b> ${this.formatCurrency(item.monto)}</p>
        <p><b>C.Pago:</b> ${item.medioPago || '-'}</p>
        <p><b>Usuario:</b> ${item.usuario || '-'}</p>
      </body></html>
    `);
    ventana.document.close();
    ventana.print();
    ventana.close();
  }

  formatCurrency(n: number): string {
    return (n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatFecha(s: string): string {
    if (!s) return '-';
    const d = new Date(s);
    return d.toLocaleDateString('es-PE');
  }
}
