import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { CajaOperacionContextService, EmpresaCajaOperacion } from '../../../services/caja-operacion-context.service';
import { ComprasService } from '../../../services/compras.service';
import { ProveedoresService } from '../../../services/proveedores.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

export interface CompraProveedorItem {
  idCompra: string;
  fecha: string;
  documento: string;
  idProveedor: number;
  proveedor: string;
  ruc?: string;
  deuda: number;
  pagado: number;
  saldo: number;
  idEstadoPago: number;
  idMediosPago?: number;
  medioPago?: string;
}

export interface ComprobantePagoRow {
  item: number;
  idCompra: string;
  comprobante: string;
  fechaVenta: string;
  totalComprobante: number;
  fechaVencimiento: string;
  importePagado: number;
}

@Component({
  selector: 'app-pago-proveedores',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './pago-proveedores.component.html',
  styleUrl: './pago-proveedores.component.css'
})
export class PagoProveedoresComponent implements OnInit {
  list: CompraProveedorItem[] = [];
  proveedores: any[] = [];
  cajas: any[] = [];
  tiposMovimiento: any[] = [];
  mediosPago: any[] = [];
  loading = false;

  empresasOperacion: EmpresaCajaOperacion[] = [];
  idEmpresaOperacionSel = '';

  filtros = {
    numero: '',
    buscar: ''
  };

  mostrarForm = false;
  mostrarVer = false;
  itemVer: CompraProveedorItem | null = null;

  /** Proveedor seleccionado en el modal (id y datos) */
  proveedorSeleccionado: { idProveedor: number; ruc: string; razonSocial: string; direccion?: string } | null = null;
  proveedorBusqueda = '';
  comprobantes: ComprobantePagoRow[] = [];

  form = {
    serie: '0001',
    numero: '0000002',
    fechaEmision: '',
    idApertura: '',
    idTipoMovimientoCaja: 0,
    importeACancelar: 0,
    observaciones: '',
    idMediosPago: null as number | null
  };

  /** idEstadoPago: 1 = Pendiente, 2 = Pagado (según sistema) */
  private readonly ESTADO_PENDIENTE = 1;
  private readonly ESTADO_PAGADO = 2;

  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.list.length;
  }
  get listPaginated(): CompraProveedorItem[] {
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
    private comprasService: ComprasService,
    private proveedoresService: ProveedoresService,
    private tablasSunat: TablasSunatService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    const hoy = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })();
    this.form.fechaEmision = hoy;
    this.cargarDatos();
    this.cargarProveedores();
    this.tiposEgreso();
    this.tablasSunat.obtener_medios_pago().subscribe({
      next: (r) => { this.mediosPago = r.data || []; },
      error: () => {}
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
    this.cargarLista();
    if (this.proveedorSeleccionado) {
      this.cargarComprobantesProveedor();
    }
  }

  cargarDatos(): void {
    this.cajaService.obtenerCajas(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => {
        this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura);
      },
      error: () => {}
    });
  }

  cargarProveedores(): void {
    this.proveedoresService.obtener_proveedores().subscribe({
      next: (r) => {
        this.proveedores = r.data || r || [];
        this.cargarLista();
      },
      error: () => { this.cargarLista(); }
    });
  }

  cargarLista(): void {
    this.loading = true;
    this.comprasService.obtener_compras_todos_idEmpresa(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => {
        const compras: any[] = r.data || [];
        this.list = compras.map((c: any) => this.mapearCompra(c));
        if (this.filtros.buscar) {
          const b = this.filtros.buscar.toLowerCase();
          this.list = this.list.filter(x =>
            (x.proveedor || '').toLowerCase().includes(b) ||
            (x.documento || '').toLowerCase().includes(b) ||
            (x.ruc || '').includes(this.filtros.buscar)
          );
        }
        if (this.filtros.numero) {
          this.list = this.list.filter(x => (x.documento || '').includes(this.filtros.numero));
        }
        this.page = 1;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        iziToast.error({ title: 'Error', message: 'Error al cargar compras.' });
      }
    });
  }

  private mapearCompra(c: any): CompraProveedorItem {
    const total = Number(c.total || 0);
    const esPendiente = Number(c.idEstadoPago) === this.ESTADO_PENDIENTE;
    const deuda = esPendiente ? total : 0;
    const pagado = esPendiente ? 0 : total;
    const saldo = esPendiente ? total : 0;
    const proveedor = this.proveedores.find((p: any) => p.idProveedor === c.idProveedor);
    return {
      idCompra: c.idCompra,
      fecha: c.fEmision,
      documento: (c.serie || '') + '-' + (c.numero || ''),
      idProveedor: c.idProveedor,
      proveedor: proveedor ? (proveedor.rSocial || proveedor.razonSocial || proveedor.nombre || '') : '',
      ruc: proveedor?.ruc || proveedor?.nroDoc || '',
      deuda,
      pagado,
      saldo,
      idEstadoPago: c.idEstadoPago,
      idMediosPago: c.idMediosPago,
      medioPago: ''
    };
  }

  buscar(): void {
    this.cargarLista();
  }

  abrirNuevo(): void {
    this.proveedorSeleccionado = null;
    this.proveedorBusqueda = '';
    this.comprobantes = [];
    this.form = {
      serie: '0001',
      numero: '0000002',
      fechaEmision: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(),
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      idTipoMovimientoCaja: this.tiposMovimiento.length ? this.tiposMovimiento[0].idTipoMovimientoCaja : 0,
      importeACancelar: 0,
      observaciones: '',
      idMediosPago: null
    };
    this.mostrarForm = true;
    this.cargarLista();
  }

  buscarProveedor(): void {
    const term = (this.proveedorBusqueda || '').trim();
    if (term.length < 8) return;
    this.proveedoresService.obtener_proveedor_ruc(term).subscribe({
      next: (r) => {
        const data = r.data || r;
        const p = Array.isArray(data) ? data[0] : data;
        if (p) {
          this.seleccionarProveedor(p);
        } else {
          iziToast.warning({ title: 'No encontrado', message: 'Proveedor no encontrado con ese RUC/documento.' });
        }
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'Error al buscar proveedor.' });
      }
    });
  }

  seleccionarProveedor(p: any): void {
    this.proveedorSeleccionado = {
      idProveedor: p.idProveedor,
      ruc: p.ruc || p.nroDoc || '',
      razonSocial: p.rSocial || p.razonSocial || p.nombre || '',
      direccion: p.direccion || ''
    };
    this.cargarComprobantesProveedor();
  }

  private cargarComprobantesProveedor(): void {
    if (!this.proveedorSeleccionado) return;
    this.comprasService.obtener_compras_todos_idEmpresa(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => {
        const compras: any[] = (r.data || []).filter((c: any) => c.idProveedor === this.proveedorSeleccionado!.idProveedor && Number(c.idEstadoPago) === this.ESTADO_PENDIENTE);
        this.comprobantes = compras.map((c: any, i: number) => ({
          item: i + 1,
          idCompra: c.idCompra,
          comprobante: (c.serie || '') + '-' + (c.numero || ''),
          fechaVenta: c.fEmision,
          totalComprobante: Number(c.total || 0),
          fechaVencimiento: c.fVencimiento || c.fEmision,
          importePagado: 0
        }));
      }
    });
  }

  get deudaTotal(): number {
    return this.comprobantes.reduce((sum, c) => sum + c.totalComprobante, 0);
  }

  get totalImportePagado(): number {
    return this.comprobantes.reduce((sum, c) => sum + (c.importePagado || 0), 0);
  }

  get saldoDespuesPago(): number {
    return this.deudaTotal - this.totalImportePagado;
  }

  cerrarForm(): void {
    this.mostrarForm = false;
    this.proveedorSeleccionado = null;
    this.comprobantes = [];
  }

  ver(item: CompraProveedorItem): void {
    this.itemVer = item;
    this.mostrarVer = true;
  }

  /** Abre el modal Recibo de Pago con el proveedor de la compra seleccionado */
  editar(item: CompraProveedorItem): void {
    this.proveedorSeleccionado = {
      idProveedor: item.idProveedor,
      ruc: item.ruc || '',
      razonSocial: item.proveedor,
      direccion: ''
    };
    this.proveedorBusqueda = item.ruc || '';
    this.comprobantes = [];
    this.form = {
      serie: '0001',
      numero: '0000002',
      fechaEmision: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(),
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      idTipoMovimientoCaja: this.tiposMovimiento.length ? this.tiposMovimiento[0].idTipoMovimientoCaja : 0,
      importeACancelar: item.saldo || 0,
      observaciones: '',
      idMediosPago: null
    };
    this.cargarComprobantesProveedor();
    this.proveedoresService.obtener_proveedor_id(item.idProveedor).subscribe({
      next: (r) => {
        const p = r.data || r;
        if (p && this.proveedorSeleccionado) {
          this.proveedorSeleccionado.direccion = p.direccion || '';
        }
      },
      error: () => {}
    });
    this.mostrarForm = true;
  }

  /** Este listado muestra compras; para anular un pago use Recibos de Egreso */
  eliminar(item: CompraProveedorItem): void {
    if (!confirm('¿Desea obtener información para anular un pago?')) return;
    iziToast.info({
      title: 'Eliminar / Anular',
      message: 'Este listado muestra compras. Para anular un pago registrado en caja, use el módulo Recibos de Egreso. Para eliminar o editar la compra, use el módulo Compras.'
    });
  }

  /** Abre ventana de impresión con los datos del comprobante */
  imprimir(item: CompraProveedorItem): void {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    ventana.document.write(`
      <html><head><title>Comprobante ${item.documento || ''}</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>Comprobante - Pago a Proveedores</h2>
        <p><b>Documento:</b> ${item.documento || '-'}</p>
        <p><b>Fecha:</b> ${this.formatFecha(item.fecha)}</p>
        <p><b>Proveedor:</b> ${item.proveedor || '-'}</p>
        <p><b>RUC:</b> ${item.ruc || '-'}</p>
        <p><b>Deuda:</b> ${this.formatCurrency(item.deuda)}</p>
        <p><b>Pagado:</b> ${this.formatCurrency(item.pagado)}</p>
        <p><b>Saldo:</b> ${this.formatCurrency(item.saldo)}</p>
        <p><b>C.Pago:</b> ${item.medioPago || '-'}</p>
      </body></html>
    `);
    ventana.document.close();
    ventana.print();
    ventana.close();
  }

  cerrarVer(): void {
    this.mostrarVer = false;
    this.itemVer = null;
  }

  guardar(): void {
    const importe = this.form.importeACancelar > 0 ? this.form.importeACancelar : this.totalImportePagado;
    if (importe <= 0) {
      iziToast.warning({ title: 'Advertencia', message: 'Ingrese importe a cancelar o asigne importes en la tabla.' });
      return;
    }
    if (!this.proveedorSeleccionado) {
      iziToast.warning({ title: 'Advertencia', message: 'Seleccione un proveedor.' });
      return;
    }
    if (!this.form.idApertura) {
      iziToast.warning({ title: 'Advertencia', message: 'Debe haber una caja abierta.' });
      return;
    }
    if (!this.form.idTipoMovimientoCaja) {
      iziToast.warning({ title: 'Advertencia', message: 'Configure tipos de movimiento Egreso en el sistema.' });
      return;
    }

    const concepto = `Pago a proveedor - ${this.proveedorSeleccionado.razonSocial} (${this.proveedorSeleccionado.ruc})`;
    const observaciones = [this.form.observaciones, `Recibo: ${this.form.serie}-${this.form.numero}`].filter(Boolean).join(' | ');

    this.cajaService.registrarMovimientoEgreso({
      idApertura: this.form.idApertura,
      idTipoMovimientoCaja: this.form.idTipoMovimientoCaja,
      concepto,
      monto: importe,
      idMediosPago: this.form.idMediosPago ?? undefined,
      observaciones: observaciones || undefined,
      idEmpresaOperacion: this.idEmpresaOperacionSel || null
    }).subscribe({
      next: (data: any) => {
        const comprobante = (data?.documentoRelacionado || '').toString().trim() || 'N/A';
        iziToast.success({
          title: 'Éxito',
          message: 'Pago registrado. Comprobante: Recibo de Egreso ' + comprobante + '. El monto se refleja en el arqueo de caja.'
        });
        this.cerrarForm();
        this.cargarLista();
        this.cargarDatos();
      },
      error: (e) => {
        iziToast.error({ title: 'Error', message: e.error?.message || 'Error al guardar.' });
      }
    });
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
