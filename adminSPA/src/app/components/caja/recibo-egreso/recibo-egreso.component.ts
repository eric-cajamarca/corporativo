import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { CajaOperacionContextService, EmpresaCajaOperacion } from '../../../services/caja-operacion-context.service';
import { CatalogosService } from '../../../services/catalogos.service';
import { DocumentoService } from '../../../services/documento.service';
import { FormaPago } from '../../../interfaces/formasPago-interface';
import { AuthService } from '../../../services/auth.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { fechaEmisionVentaParaApi } from '../../../utils/fecha-local.util';

declare var iziToast: any;

export interface ReciboEgresoItem {
  idMovimientoCaja: string;
  empresaMovimiento?: string;
  idApertura?: string;
  fechaMovimiento: string;
  concepto: string;
  monto: number;
  tipoMovimiento?: string;
  medioPago?: string;
  idMediosPago?: number;
  documentoRelacionado?: string;
  observaciones?: string;
  usuario?: string;
  glosa?: string;
  entregueA?: string;
}

@Component({
  selector: 'app-recibo-egreso',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './recibo-egreso.component.html',
  styleUrl: './recibo-egreso.component.css'
})
export class ReciboEgresoComponent implements OnInit {
  list: ReciboEgresoItem[] = [];
  cajas: any[] = [];
  tiposMovimiento: any[] = [];
  conceptos: any[] = [];
  formasPago: FormaPago[] = [];
  formaPagoSeleccionada: FormaPago = { idFormaPago: 0, descripcion: '', tipo: 0, requiereReferencia: 0 };
  mostrarModalFormaPago = false;
  loading = false;

  empresasOperacion: EmpresaCajaOperacion[] = [];
  idEmpresaOperacionSel = '';

  filtros = {
    numero: '',
    buscar: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  mostrarForm = false;
  mostrarVer = false;
  editandoId: string | null = null;
  itemVer: ReciboEgresoItem | null = null;

  form = {
    idApertura: '',
    idTipoMovimientoCaja: 0,
    idConcepto: '' as string,
    concepto: '',
    personal: '',
    glosa: '',
    entregueA: '',
    importe: 0,
    tipoDocumento: '',
    referencia: '',
    fechaEmision: ''
  };

  serie = '0001';
  numero = '';

  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.list.length;
  }
  get listPaginated(): ReciboEgresoItem[] {
    const start = (this.page - 1) * this.pageSize;
    return this.list.slice(start, start + this.pageSize);
  }
  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }
  get paginas(): number[] {
    return Array.from({ length: this.totalPaginas }, (_, i) => i + 1);
  }
  desdePagina(): number {
    return (this.page - 1) * this.pageSize + 1;
  }
  hastaPagina(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }
  cambiarPagina(p: number): void {
    if (p < 1 || p > this.totalPaginas) return;
    this.page = p;
  }

  constructor(
    private cajaService: CajaService,
    private cajaOpCtx: CajaOperacionContextService,
    private catalogosService: CatalogosService,
    private documentoService: DocumentoService,
    private authService: AuthService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const hoy = this.fechaLocalHoy();
    this.filtros.fechaDesde = '';
    this.filtros.fechaHasta = '';
    this.form.fechaEmision = hoy;
    this.cajaOpCtx.cargarContexto().subscribe({
      next: () => {
        this.empresasOperacion = this.cajaOpCtx.empresasOperacion;
        this.idEmpresaOperacionSel = this.cajaOpCtx.idEmpresaOperacion || '';
        this.cargarDatos();
        this.cargarRecibos();
        this.cargarConceptos();
      },
      error: () => {
        this.cargarDatos();
        this.cargarRecibos();
        this.cargarConceptos();
      }
    });
    this.tiposEgreso();
    this.documentoService.getFormasPago().subscribe({
      next: (r) => {
        this.formasPago = r.data || [];
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) this.formaPagoSeleccionada = { ...efectivo };
        else if (this.formasPago.length) this.formaPagoSeleccionada = { ...this.formasPago[0] };
      },
      error: () => { this.formasPago = []; }
    });
  }

  private tiposEgreso(): void {
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (r) => {
        this.tiposMovimiento = (r.data || []).filter((t: any) => t.tipo === 'E');
        if (this.tiposMovimiento.length && !this.form.idTipoMovimientoCaja) {
          this.form.idTipoMovimientoCaja = this.tiposMovimiento[0].idTipoMovimientoCaja;
        }
      },
      error: () => {}
    });
  }

  onCambioEmpresaOperacion(id: string): void {
    this.cajaOpCtx.setEmpresaOperacion(id);
    this.idEmpresaOperacionSel = id;
    this.cargarDatos();
    this.cargarRecibos();
    this.cargarConceptos();
    if (this.mostrarForm && !this.editandoId) {
      this.form.idConcepto = '';
    }
  }

  cargarConceptos(): void {
    this.catalogosService
      .listarConceptosPorTipo('EGRESO', this.idEmpresaOperacionSel || null)
      .subscribe({
        next: (r) => {
          this.conceptos = r.data || [];
        },
        error: () => {
          this.conceptos = [];
        }
      });
  }

  get empresaOperacionLabel(): string {
    const id = this.idEmpresaOperacionSel;
    const e = this.empresasOperacion.find((x) => x.idEmpresa === id);
    return e ? (e.razonSocial || e.ruc || id) : '—';
  }

  private esCajaMultiEmpresa(): boolean {
    return this.empresasOperacion.length > 1;
  }

  get colspanTablaRecibos(): number {
    return this.esCajaMultiEmpresa() ? 10 : 9;
  }

  onCambioEmpresaOperacionDesdeModal(id: string): void {
    this.cajaOpCtx.setEmpresaOperacion(id);
    this.idEmpresaOperacionSel = id;
    this.cargarRecibos();
    this.cargarConceptos();
    if (!this.editandoId) {
      this.form.idConcepto = '';
    }
    this.cajaService.obtenerCajas(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
        if (!this.editandoId) {
          const ok = this.cajas.some((c: any) => c.idApertura === this.form.idApertura);
          if (!ok) {
            this.form.idApertura = this.cajas.length ? this.cajas[0].idApertura : '';
          }
        }
      },
      error: () => {}
    });
  }

  cargarDatos(): void {
    this.cajaService.obtenerCajas(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
      },
      error: () => {}
    });
  }

  private fechaLocalHoy(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }

  get hayFiltroFecha(): boolean {
    return !!(this.filtros.fechaDesde || this.filtros.fechaHasta);
  }

  limpiarFiltroFechas(): void {
    this.filtros.fechaDesde = '';
    this.filtros.fechaHasta = '';
    this.cargarRecibos();
  }

  cargarRecibos(): void {
    this.loading = true;
    const desde = this.filtros.fechaDesde ? this.filtros.fechaDesde + 'T00:00:00' : undefined;
    const hasta = this.filtros.fechaHasta ? this.filtros.fechaHasta + 'T23:59:59' : undefined;
    this.cajaService.getRecibosEgreso(
      { fechaDesde: desde, fechaHasta: hasta },
      this.idEmpresaOperacionSel || null
    ).subscribe({
      next: (r) => {
        let data = (r.data || []).map((m: any) => this.mapItem(m));
        if (this.filtros.buscar) {
          const b = this.filtros.buscar.toLowerCase();
          data = data.filter((x: ReciboEgresoItem) =>
            (x.concepto || '').toLowerCase().includes(b) ||
            (x.entregueA || '').toLowerCase().includes(b) ||
            (x.glosa || '').toLowerCase().includes(b) ||
            (x.documentoRelacionado || '').toLowerCase().includes(b)
          );
        }
        if (this.filtros.numero) {
          data = data.filter((x: ReciboEgresoItem) => (x.documentoRelacionado || '').includes(this.filtros.numero));
        }
        this.list = data;
        this.page = 1;
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  private mapItem(m: any): ReciboEgresoItem {
    const obs = (m.observaciones || '').trim();
    let entregueA = '';
    let glosa = obs;
    if (obs.includes('|')) {
      const parts = obs.split('|').map((p: string) => p.trim());
      const ent = parts.find((p: string) => p.toLowerCase().startsWith('entregué a:') || p.toLowerCase().startsWith('entregue a:'));
      const g = parts.find((p: string) => p.toLowerCase().startsWith('glosa:'));
      if (ent) entregueA = ent.replace(/^entregu[eé] a:\s*/i, '').trim();
      if (g) glosa = g.replace(/^glosa:\s*/i, '').trim();
      if (!ent && !g && parts.length >= 2) {
        entregueA = parts[0];
        glosa = parts[1];
      }
    }
    const doc = m.documentoRelacionado || ('RE 0001-' + (m.idMovimientoCaja || '').slice(-6));
    return {
      idMovimientoCaja: m.idMovimientoCaja,
      empresaMovimiento: m.empresaMovimiento,
      idApertura: m.idApertura,
      fechaMovimiento: m.fechaMovimiento,
      concepto: m.concepto,
      monto: Number(m.monto),
      medioPago: m.medioPago,
      idMediosPago: m.idMediosPago != null ? Number(m.idMediosPago) : undefined,
      documentoRelacionado: doc,
      observaciones: m.observaciones,
      usuario: m.usuario,
      glosa,
      entregueA: entregueA || (m.observaciones && !m.observaciones.includes('|') ? m.observaciones : '')
    };
  }

  buscar(): void {
    this.cargarRecibos();
  }

  abrirNuevo(): void {
    this.editandoId = null;
    const usuarioActual = this.authService.userData()?.nombres ?? 'Usuario';
    this.form = {
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      idTipoMovimientoCaja: this.tiposMovimiento.length ? this.tiposMovimiento[0].idTipoMovimientoCaja : 0,
      idConcepto: '',
      concepto: '',
      personal: usuarioActual,
      glosa: '',
      entregueA: '',
      importe: 0,
      tipoDocumento: '',
      referencia: '',
      fechaEmision: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })()
    };
    this.numero = '';
    this.serie = '';
    this.mostrarForm = true;
  }

  editar(item: ReciboEgresoItem): void {
    this.editandoId = item.idMovimientoCaja;
    this.form = {
      idApertura: item.idApertura || '',
      idTipoMovimientoCaja: 0,
      idConcepto: (item as any).idConcepto || '',
      concepto: item.concepto,
      personal: item.usuario || '',
      glosa: item.glosa || '',
      entregueA: item.entregueA || '',
      importe: item.monto,
      tipoDocumento: '',
      referencia: item.documentoRelacionado || '',
      fechaEmision: item.fechaMovimiento ? item.fechaMovimiento.split('T')[0] : ''
    };
    this.numero = item.documentoRelacionado || '';
    this.mostrarForm = true;
  }

  ver(item: ReciboEgresoItem): void {
    this.itemVer = item;
    this.mostrarVer = true;
  }

  onConceptoChange(idConcepto: string): void {
    if (!idConcepto) {
      return;
    }
    const c = this.conceptos.find((x: any) => x.idConcepto === idConcepto);
    if (!c) return;
    if (c.descripcion) this.form.concepto = c.descripcion;
    if (c.idTipoMovimientoCaja != null && this.tiposMovimiento.some((t: any) => t.idTipoMovimientoCaja === c.idTipoMovimientoCaja)) {
      this.form.idTipoMovimientoCaja = c.idTipoMovimientoCaja;
    }
  }

  cerrarForm(): void {
    this.mostrarForm = false;
    this.mostrarModalFormaPago = false;
    this.editandoId = null;
  }

  /** Concepto de texto o al menos catálogo (idConcepto); el backend puede completar la descripción. */
  private formTieneConcepto(): boolean {
    const txt = (this.form.concepto || '').trim();
    const idCat = (this.form.idConcepto || '').trim();
    return !!(txt || idCat);
  }

  private formImporteValido(): boolean {
    const n = Number(this.form.importe);
    return Number.isFinite(n) && n > 0;
  }

  abrirModalFormaPago(): void {
    if (!this.formTieneConcepto() || !this.formImporteValido()) {
      iziToast.warning({ title: 'Advertencia', message: 'Concepto (texto o catálogo) e importe mayor a 0 son obligatorios.' });
      return;
    }
    if (!this.editandoId && !this.form.idApertura) {
      iziToast.warning({ title: 'Advertencia', message: 'Debe haber una caja abierta para registrar el egreso.' });
      return;
    }
    const idTipo = Number(this.form.idTipoMovimientoCaja);
    if (!Number.isFinite(idTipo) || idTipo <= 0) {
      iziToast.warning({ title: 'Advertencia', message: 'No hay tipo de movimiento Egreso configurado.' });
      return;
    }
    if (this.editandoId) {
      const item = this.list.find((x) => x.idMovimientoCaja === this.editandoId);
      const fp = item?.idMediosPago != null ? this.formasPago.find((f) => f.idFormaPago === item!.idMediosPago) : null;
      if (fp) this.formaPagoSeleccionada = { ...fp };
      else {
        const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
        if (efectivo) this.formaPagoSeleccionada = { ...efectivo };
        else if (this.formasPago.length) this.formaPagoSeleccionada = { ...this.formasPago[0] };
      }
    } else {
      const efectivo = this.formasPago.find((f: FormaPago) => (f.descripcion || '').toUpperCase() === 'EFECTIVO');
      if (efectivo) this.formaPagoSeleccionada = { ...efectivo };
      else if (this.formasPago.length) this.formaPagoSeleccionada = { ...this.formasPago[0] };
    }
    this.mostrarModalFormaPago = true;
  }

  cerrarModalFormaPago(): void {
    this.mostrarModalFormaPago = false;
  }

  confirmarGuardarConFormaPago(): void {
    const idForma = this.formaPagoSeleccionada?.idFormaPago != null ? Number(this.formaPagoSeleccionada.idFormaPago) : 0;
    if (!idForma) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione la forma de pago.' });
      return;
    }
    this.mostrarModalFormaPago = false;
    this.guardar(idForma);
  }

  cerrarVer(): void {
    this.mostrarVer = false;
    this.itemVer = null;
  }

  guardar(idFormaPago?: number): void {
    const idMediosPago = idFormaPago ?? (this.form as any).idMediosPago;
    const observaciones = [this.form.entregueA ? 'Entregué a: ' + this.form.entregueA : '', this.form.glosa ? 'Glosa: ' + this.form.glosa : ''].filter(Boolean).join(' | ');

    if (this.editandoId) {
      this.cajaService.actualizarMovimiento(this.editandoId, {
        concepto: this.form.concepto,
        idConcepto: this.form.idConcepto || undefined,
        monto: this.form.importe,
        idMediosPago: idMediosPago ?? undefined,
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
      iziToast.warning({ title: 'Advertencia', message: 'Debe haber una caja abierta para registrar el egreso.' });
      return;
    }
    const idTipoGuardar = Number(this.form.idTipoMovimientoCaja);
    if (!Number.isFinite(idTipoGuardar) || idTipoGuardar <= 0) {
      iziToast.warning({ title: 'Advertencia', message: 'No hay tipo de movimiento Egreso configurado. Configure TiposMovimientoCaja en la base de datos.' });
      return;
    }
    this.cajaService.registrarMovimientoEgreso({
      idApertura: this.form.idApertura,
      idTipoMovimientoCaja: idTipoGuardar,
      fechaMovimiento: fechaEmisionVentaParaApi(this.form.fechaEmision),
      concepto: this.form.concepto,
      idConcepto: this.form.idConcepto || undefined,
      monto: this.form.importe,
      idMediosPago: idMediosPago ?? undefined,
      documentoRelacionado: this.form.referencia?.trim() || undefined,
      observaciones: observaciones || undefined,
      idEmpresaOperacion: this.idEmpresaOperacionSel || null
    }).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Recibo de egreso registrado.' });
        this.cerrarForm();
        this.cargarRecibos();
        this.cargarDatos();
      },
      error: (e) => {
        iziToast.error({ title: 'Error', message: e.error?.message || 'Error al guardar.' });
      }
    });
  }

  eliminar(item: ReciboEgresoItem): void {
    if (!confirm('¿Eliminar este recibo de egreso?')) return;
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

  imprimir(item: ReciboEgresoItem): void {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head><title>Recibo Egreso ${item.documentoRelacionado || ''}</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>Recibo de Egreso</h2>
        <p><b>Documento:</b> ${item.documentoRelacionado || '-'}</p>
        <p><b>Fecha:</b> ${this.formatFecha(item.fechaMovimiento)}</p>
        <p><b>Concepto:</b> ${item.concepto}</p>
        <p><b>Glosa:</b> ${item.glosa || '-'}</p>
        <p><b>Entregué a:</b> ${item.entregueA || '-'}</p>
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
