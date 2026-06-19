import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { from, of, throwError } from 'rxjs';
import { catchError, concatMap, map, switchMap } from 'rxjs/operators';
import { CreditosService } from '../../../services/creditos.service';
import { CajaOperacionContextService, EmpresaCajaOperacion } from '../../../services/caja-operacion-context.service';
import { ClienteService } from '../../../services/cliente.service';
import { CajaService } from '../../../services/caja.service';
import { TablasSunatService } from '../../../services/tablas-sunat.service';
import { CreditoCliente, CuotaCredito, ResumenCreditos } from '../../../interfaces/creditos-interface';
import { Cliente } from '../../../interfaces/cliente-interface';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { fechaHoraVentaClienteAhora } from '../../../utils/fecha-local.util';
import { IndexClientesComponent } from '../../clientes/index-clientes/index-clientes.component';

declare var iziToast: any;

export interface DetalleCobranzaItem {
  idCredito: string;
  /** Empresa del crédito para API de cuotas y pago */
  idEmpresa?: string;
  comprobante: string;
  fechaVenta: string;
  totalComprobante: number;
  fechaVencimiento: string;
  importePagado: number;
  saldoPendiente: number;
}

@Component({
  selector: 'app-index-creditos',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent, IndexClientesComponent],
  templateUrl: './index-creditos.component.html',
  styleUrl: './index-creditos.component.css'
})
export class IndexCreditosComponent implements OnInit {
  public creditos: CreditoCliente[] = [];
  public cuotas: CuotaCredito[] = [];
  public clientes: Cliente[] = [];
  public resumenCreditos: ResumenCreditos | null = null;

  public creditoSeleccionado: CreditoCliente | null = null;
  public clienteSeleccionado: Cliente | null = null;

  public mostrarModalNuevoCredito = false;
  public mostrarModalPagarCuota = false;
  public mostrarCuotas = false;

  public mostrarModalNuevaCobranza = false;
  public mostrarModalBuscarCliente = false;
  public mostrarModalBuscarComprobantes = false;
  public creditosClienteParaSelector: (CreditoCliente & { comprobante?: string; proximaCuota?: string })[] = [];
  public loadingCreditosCliente = false;

  public nuevaCobranza = {
    numeroDoc: '',
    fechaEmision: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(),
    idCliente: '',
    nombreCliente: '',
    direccion: '',
    lineaAsignada: 0,
    deudaTotal: 0,
    aptoCreditos: '—',
    importeCancelar: 0,
    idMediosPago: null as number | null,
    idApertura: '' as string,
    observaciones: ''
  };
  public detalleCobranza: DetalleCobranzaItem[] = [];

  public nuevoCredito = {
    idCliente: '',
    idVenta: '',
    montoTotal: 0,
    interes: 0,
    numeroCuotas: 1,
    cuotaInicial: 0
  };

  public cajas: any[] = [];
  public mediosPago: any[] = [];
  public pagoCuota = {
    idCuota: '',
    montoPagado: 0,
    formaPago: '',
    idMediosPago: null as number | null,
    idApertura: '' as string,
    referencia: '',
    observaciones: ''
  };

  public filtros = {
    idCliente: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: '',
    numero: '',
    buscar: ''
  };

  public loading = false;
  public mostrarVerCuotas = false;
  cuotasSeleccionadasMasivo = new Set<string>();

  empresasOperacion: EmpresaCajaOperacion[] = [];
  idEmpresaOperacionSel = '';

  constructor(
    private creditosService: CreditosService,
    private clienteService: ClienteService,
    private cajaService: CajaService,
    private cajaOpCtx: CajaOperacionContextService,
    private tablasSunat: TablasSunatService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cajaOpCtx.cargarContexto().subscribe({
      next: () => {
        this.empresasOperacion = this.cajaOpCtx.empresasOperacion;
        this.idEmpresaOperacionSel = this.cajaOpCtx.idEmpresaOperacion || '';
        this.cargarResumenCreditos();
        this.cargarCreditos();
        this.cajaService.obtenerCajas(this.idEmpresaOperacionSel || null).subscribe({
          next: (r) => { this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura); },
          error: () => {}
        });
      },
      error: () => {
        this.cargarResumenCreditos();
        this.cargarCreditos();
        this.cajaService.obtenerCajas().subscribe({
          next: (r) => { this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura); },
          error: () => {}
        });
      }
    });
    this.tablasSunat.obtener_medios_pago().subscribe({
      next: (r) => { this.mediosPago = r.data || []; },
      error: () => {}
    });
  }

  private esCajaMultiEmpresa(): boolean {
    return this.empresasOperacion.length > 1;
  }

  /** Listado y resumen consolidados (sin filtrar por una sola empresa). */
  private idEmpresaOperacionParaListado(): string | null {
    return this.esCajaMultiEmpresa() ? null : (this.idEmpresaOperacionSel || null);
  }

  /** Caja y registro de cobro: empresa elegida en el selector. */
  private idEmpresaOpRegistro(): string | null {
    return this.idEmpresaOperacionSel || null;
  }

  /** Empresa del crédito en listados consolidados; si no viene, la del selector. */
  idEmpresaDelCredito(c: Pick<CreditoCliente, 'idEmpresa'>): string | null {
    const raw = c.idEmpresa;
    if (raw != null && String(raw).trim() !== '') {
      return String(raw).trim();
    }
    return this.idEmpresaOpRegistro();
  }

  onCambioEmpresaOperacion(id: string): void {
    this.cajaOpCtx.setEmpresaOperacion(id);
    this.idEmpresaOperacionSel = id;
    this.cargarResumenCreditos();
    this.cargarCreditos();
    this.cajaService.obtenerCajas(this.idEmpresaOperacionSel || null).subscribe({
      next: (r) => { this.cajas = (r.data || []).filter((c: any) => c.cajaAbierta && c.idApertura); },
      error: () => {}
    });
  }

  cargarClientes() {
    this.clienteService.obtener_clientes().subscribe({
      next: (response) => {
        this.clientes = response.clientes || response.data || [];
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
      }
    });
  }

  cargarCreditos() {
    this.loading = true;
    this.creditosService.obtenerCreditosCliente(this.filtros.idCliente || '', this.idEmpresaOperacionParaListado()).subscribe({
      next: (response) => {
        if (response.data) {
          this.creditos = response.data;
        } else {
          this.creditos = [];
        }
        this.loading = false;
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'Error al cargar los créditos' });
        this.loading = false;
      }
    });
  }

  /** Lista filtrada por numero y buscar (y opcionalmente por estado/fechas) */
  get creditosFiltrados(): CreditoCliente[] {
    let list = this.creditos;
    const b = (this.filtros.buscar || '').toLowerCase().trim();
    const n = (this.filtros.numero || '').trim();
    if (b) {
      list = list.filter(c => {
        const nombre = this.getClienteNombre(c.idCliente).toLowerCase();
        const doc = (c.idVenta || '').toLowerCase();
        const id = (c.idCredito || '').toLowerCase();
        return nombre.includes(b) || doc.includes(b) || id.includes(b);
      });
    }
    if (n) {
      list = list.filter(c =>
        (c.idCredito || '').includes(n) || (c.idVenta || '').includes(n)
      );
    }
    if (this.filtros.estado) {
      list = list.filter(c => c.estado === this.filtros.estado);
    }
    if (this.filtros.fechaDesde) {
      list = list.filter(c => (c.fechaCredito || '').split('T')[0] >= this.filtros.fechaDesde);
    }
    if (this.filtros.fechaHasta) {
      list = list.filter(c => (c.fechaCredito || '').split('T')[0] <= this.filtros.fechaHasta);
    }
    return list;
  }

  /** Solo créditos con saldo pendiente > 0 (para pantalla principal) */
  get creditosPendientes(): CreditoCliente[] {
    return this.creditosFiltrados.filter(c => (c.saldoPendiente ?? 0) > 0);
  }

  buscar() {
    this.cargarCreditos();
  }

  getPagado(credito: CreditoCliente): number {
    if (credito.totalPagado != null) return credito.totalPagado;
    const saldo = credito.saldoPendiente ?? 0;
    return Math.max(0, (credito.montoTotal || 0) - saldo);
  }

  cargarResumenCreditos() {
    this.creditosService.obtenerResumenCreditos(this.idEmpresaOperacionParaListado()).subscribe({
      next: (response) => {
        if (response.data) {
          this.resumenCreditos = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar resumen:', error);
      }
    });
  }

  /** Abre modal Ver Cuotas y carga las cuotas del crédito */
  verCuotas(credito: CreditoCliente) {
    this.creditoSeleccionado = credito;
    this.mostrarVerCuotas = true;
    this.loading = true;
    this.creditosService.obtenerCuotasCredito(credito.idCredito, this.idEmpresaDelCredito(credito)).subscribe({
      next: (response) => {
        this.cuotas = response.data || [];
        this.loading = false;
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'Error al cargar las cuotas' });
        this.loading = false;
      }
    });
  }

  ver(credito: CreditoCliente) {
    this.verCuotas(credito);
  }

  /** Editar: abre el modal de cuotas para gestionar pagos */
  editar(credito: CreditoCliente) {
    this.verCuotas(credito);
  }

  eliminar(credito: CreditoCliente) {
    if (!confirm('¿Desea obtener información sobre eliminación de créditos?')) return;
    iziToast.info({
      title: 'Eliminar crédito',
      message: 'La eliminación o cancelación de créditos debe realizarse desde el módulo de administración o con el soporte del sistema.'
    });
  }

  imprimir(credito: CreditoCliente) {
    const ventana = window.open('', '_blank');
    if (!ventana) return;
    const nombre = this.getClienteNombre(credito.idCliente);
    const pagado = this.getPagado(credito);
    const saldo = credito.saldoPendiente ?? 0;
    ventana.document.write(`
      <html><head><title>Crédito ${credito.idCredito}</title></head>
      <body style="font-family: sans-serif; padding: 20px;">
        <h2>Cobranza de Créditos - Comprobante</h2>
        <p><b>Id. Crédito:</b> ${credito.idCredito || '-'}</p>
        <p><b>Cliente:</b> ${nombre}</p>
        <p><b>Fecha:</b> ${credito.fechaCredito ? new Date(credito.fechaCredito).toLocaleDateString('es-PE') : '-'}</p>
        <p><b>Documento/Venta:</b> ${credito.idVenta || '-'}</p>
        <p><b>Monto Total:</b> S/ ${(credito.montoTotal ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        <p><b>Pagado:</b> S/ ${pagado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        <p><b>Saldo:</b> S/ ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
        <p><b>Estado:</b> ${credito.estado || '-'}</p>
      </body></html>
    `);
    ventana.document.close();
    ventana.print();
    ventana.close();
  }

  cerrarModalVerCuotas() {
    this.mostrarVerCuotas = false;
    this.creditoSeleccionado = null;
    this.cuotas = [];
    this.cuotasSeleccionadasMasivo.clear();
  }

  toggleCuotaMasivo(idCuota: string, checked: boolean): void {
    if (checked) {
      this.cuotasSeleccionadasMasivo.add(idCuota);
    } else {
      this.cuotasSeleccionadasMasivo.delete(idCuota);
    }
  }

  cuotaSeleccionadaMasivo(idCuota: string): boolean {
    return this.cuotasSeleccionadasMasivo.has(idCuota);
  }

  cobrarCuotasSeleccionadasMasivo(): void {
    const pendientes = (this.cuotas || []).filter(
      (c) =>
        this.cuotasSeleccionadasMasivo.has(c.idCuota) &&
        c.estado !== 'PAGADO'
    );
    if (!pendientes.length) {
      iziToast.warning({ title: 'Aviso', message: 'Seleccione cuotas pendientes para cobrar.' });
      return;
    }
    if (this.pagoCuota.idMediosPago == null && this.mediosPago.length > 0) {
      this.pagoCuota.idMediosPago = this.mediosPago[0].idMediosPago;
    }
    this.loading = true;
    this.creditosService
      .pagarCuotasMasivo({
        pagos: pendientes.map((c) => ({
          idCuota: c.idCuota,
          montoPagado: Number(c.saldoPendiente) || Number(c.montoCuota) || 0,
          idEmpresaOperacion: this.idEmpresaOperacionSel || undefined
        })),
        idMediosPago: this.pagoCuota.idMediosPago ?? undefined,
        idApertura: this.cajas.length ? this.cajas[0].idApertura : undefined,
        idEmpresaOperacion: this.idEmpresaOperacionSel || undefined,
        observaciones: 'Cobranza masiva',
        fechaPago: fechaHoraVentaClienteAhora()
      })
      .subscribe({
        next: () => {
          this.loading = false;
          iziToast.success({
            title: 'Éxito',
            message: `Se registraron ${pendientes.length} pago(s) en lote.`
          });
          this.cuotasSeleccionadasMasivo.clear();
          if (this.creditoSeleccionado) {
            this.editar(this.creditoSeleccionado);
          }
          this.cargarCreditos();
          this.cargarResumenCreditos();
        },
        error: (err) => {
          this.loading = false;
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudo completar la cobranza masiva.'
          });
        }
      });
  }

  abrirModalNuevoCredito() {
    this.nuevoCredito = {
      idCliente: '',
      idVenta: '',
      montoTotal: 0,
      interes: 0,
      numeroCuotas: 1,
      cuotaInicial: 0
    };
    this.mostrarModalNuevoCredito = true;
  }

  abrirModalNuevaCobranza() {
    this.nuevaCobranza = {
      numeroDoc: '',
      fechaEmision: (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(),
      idCliente: '',
      nombreCliente: '',
      direccion: '',
      lineaAsignada: 0,
      deudaTotal: 0,
      aptoCreditos: '—',
      importeCancelar: 0,
      idMediosPago: this.mediosPago.length ? this.mediosPago[0].idMediosPago : null,
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      observaciones: ''
    };
    this.detalleCobranza = [];
    this.mostrarModalNuevaCobranza = true;
  }

  cerrarModalNuevaCobranza() {
    this.mostrarModalNuevaCobranza = false;
  }

  abrirModalBuscarCliente() {
    this.mostrarModalBuscarCliente = true;
  }

  cerrarModalBuscarCliente() {
    this.mostrarModalBuscarCliente = false;
  }

  seleccionarClienteCobranza(cliente: any) {
    const id = (cliente?.idCliente ?? cliente?.id)?.toString().trim() || '';
    const nombre = (cliente?.rSocial ?? cliente?.r_Social ?? cliente?.nombre ?? '')?.toString().trim() || '';
    this.nuevaCobranza.idCliente = id;
    this.nuevaCobranza.nombreCliente = nombre;
    this.cerrarModalBuscarCliente();
    this.cargarDatosClienteCobranza(id);
  }

  cargarDatosClienteCobranza(idCliente: string) {
    if (!idCliente) return;
    this.clienteService.obtener_direccionesCliente_idCliente(idCliente).subscribe({
      next: (r: any) => {
        const dirs = r.data || r.direcciones || r || [];
        const primera = Array.isArray(dirs) ? dirs[0] : dirs;
        this.nuevaCobranza.direccion = (primera?.direccion ?? primera?.nombreDireccion ?? '') || '';
      },
      error: () => {}
    });
    this.clienteService.obtener_cliente_id(idCliente).subscribe({
      next: (r: any) => {
        const raw = r.data ?? r;
        const cliente = Array.isArray(raw) ? raw[0] : raw;
        const linea = cliente?.lineaCredito != null && !isNaN(Number(cliente.lineaCredito)) ? Number(cliente.lineaCredito) : 0;
        this.nuevaCobranza.lineaAsignada = linea;
      },
      error: () => { this.nuevaCobranza.lineaAsignada = 0; }
    });
    this.creditosService.obtenerCreditosCliente(idCliente, this.idEmpresaOperacionParaListado()).subscribe({
      next: (res) => {
        const list = res.data || [];
        const pendientes = list.filter((c: any) => (c.saldoPendiente ?? 0) > 0);
        const deudaTotal = pendientes.reduce((sum: number, c: any) => sum + (c.saldoPendiente ?? 0), 0);
        this.nuevaCobranza.deudaTotal = deudaTotal;
        this.nuevaCobranza.aptoCreditos = list.length > 0 ? 'Sí' : '—';
      },
      error: () => {
        this.nuevaCobranza.deudaTotal = 0;
        this.nuevaCobranza.aptoCreditos = '—';
      }
    });
  }

  abrirModalBuscarComprobantes() {
    if (!this.nuevaCobranza.idCliente) {
      iziToast.warning({ title: 'Aviso', message: 'Seleccione primero un cliente.' });
      return;
    }
    this.mostrarModalBuscarComprobantes = true;
    this.loadingCreditosCliente = true;
    this.creditosService.obtenerCreditosCliente(this.nuevaCobranza.idCliente, this.idEmpresaOperacionParaListado()).subscribe({
      next: (res) => {
        const list = (res.data || []).filter((c: any) => (c.saldoPendiente ?? 0) > 0);
        this.creditosClienteParaSelector = list;
        this.loadingCreditosCliente = false;
      },
      error: () => {
        this.creditosClienteParaSelector = [];
        this.loadingCreditosCliente = false;
      }
    });
  }

  cerrarModalBuscarComprobantes() {
    this.mostrarModalBuscarComprobantes = false;
  }

  agregarComprobanteADetalle(c: any) {
    const yaAgregado = this.detalleCobranza.some(d => d.idCredito === c.idCredito);
    if (yaAgregado) {
      iziToast.info({ title: 'Aviso', message: 'Este comprobante ya está en el detalle.' });
      return;
    }
    this.detalleCobranza.push({
      idCredito: c.idCredito,
      idEmpresa: c.idEmpresa,
      comprobante: c.comprobante || ('Venta ' + (c.idVenta || '')),
      fechaVenta: c.fechaCredito || '',
      totalComprobante: c.montoTotal ?? 0,
      fechaVencimiento: c.proximaCuota || '',
      importePagado: c.saldoPendiente ?? 0,
      saldoPendiente: c.saldoPendiente ?? 0
    });
  }

  quitarDetalleCobranza(index: number) {
    this.detalleCobranza.splice(index, 1);
  }

  get totalDetalleCobranza(): number {
    return this.detalleCobranza.reduce((sum, d) => sum + d.importePagado, 0);
  }

  guardarCobranza() {
    if (!this.nuevaCobranza.idCliente) {
      iziToast.warning({ title: 'Aviso', message: 'Seleccione un cliente.' });
      return;
    }
    const itemsConImporte = this.detalleCobranza.filter(d => Number(d.importePagado) > 0);
    if (itemsConImporte.length === 0) {
      iziToast.warning({ title: 'Aviso', message: 'Agregue comprobantes al detalle e ingrese importes a pagar en cada fila.' });
      return;
    }
    if (this.nuevaCobranza.idMediosPago == null && this.mediosPago.length > 0) {
      iziToast.warning({ title: 'Aviso', message: 'Seleccione la forma de pago.' });
      return;
    }
    this.loading = true;
    from(itemsConImporte).pipe(
      concatMap((item: DetalleCobranzaItem) => {
        const idEmpresaPago =
          (item.idEmpresa != null && String(item.idEmpresa).trim() !== '' ? String(item.idEmpresa).trim() : null) ||
          this.idEmpresaOpRegistro();
        if (!idEmpresaPago) {
          return throwError(() => new Error('Seleccione la empresa de caja o agregue comprobantes con empresa definida.'));
        }
        const payloadBase = {
          idMediosPago: this.nuevaCobranza.idMediosPago ?? undefined,
          idApertura: this.nuevaCobranza.idApertura || undefined,
          observaciones: this.nuevaCobranza.observaciones || undefined,
          idEmpresaOperacion: idEmpresaPago,
          fechaPago: fechaHoraVentaClienteAhora()
        };
        return this.creditosService.obtenerCuotasCredito(item.idCredito, idEmpresaPago).pipe(
          switchMap((res: any) => {
            const cuotas: CuotaCredito[] = res.data || [];
            const pendiente = cuotas.find((cu: CuotaCredito) => cu.estado === 'PENDIENTE' || cu.estado === 'VENCIDO');
            if (!pendiente) {
              return throwError(() => new Error('No hay cuota pendiente para ' + (item.comprobante || item.idCredito)));
            }
            const monto = Number(item.importePagado) || 0;
            if (monto <= 0) return of(null);
            return this.creditosService.pagarCuota({
              idCuota: pendiente.idCuota,
              montoPagado: monto,
              ...payloadBase
            }).pipe(
              map(() => ({ item, comprobante: '' })),
              catchError((err) => throwError(() => err))
            );
          }),
          catchError((err) => throwError(() => err))
        );
      })
    ).subscribe({
      next: () => {},
      error: (err) => {
        this.loading = false;
        console.error('Error al guardar cobranza:', err);
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || err?.message || 'Error al registrar el pago de la cobranza.'
        });
      },
      complete: () => {
        this.loading = false;
        iziToast.success({
          title: 'Éxito',
          message: 'Cobranza registrada. Los pagos se aplicaron a las cuotas pendientes y, si hay caja abierta, al Recibo de Ingreso.'
        });
        this.cerrarModalNuevaCobranza();
        this.cargarCreditos();
        this.cargarResumenCreditos();
      }
    });
  }

  abrirModalPagarCuota(cuota: CuotaCredito) {
    if (cuota.estado === 'PAGADO') {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Esta cuota ya está pagada'
      });
      return;
    }

    this.pagoCuota = {
      idCuota: cuota.idCuota,
      montoPagado: cuota.saldoPendiente ?? 0,
      formaPago: '',
      idMediosPago: this.mediosPago.length ? this.mediosPago[0].idMediosPago : null,
      idApertura: this.cajas.length ? this.cajas[0].idApertura : '',
      referencia: '',
      observaciones: ''
    };
    this.mostrarModalPagarCuota = true;
  }

  cerrarModales() {
    this.mostrarModalNuevoCredito = false;
    this.mostrarModalPagarCuota = false;
  }

  crearCredito() {
    if (!this.nuevoCredito.idCliente || this.nuevoCredito.montoTotal <= 0 ||
        this.nuevoCredito.numeroCuotas < 1) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Complete todos los campos requeridos'
      });
      return;
    }

    this.loading = true;
    this.creditosService.crearCredito({
      ...this.nuevoCredito,
      fechaCredito: fechaHoraVentaClienteAhora()
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Crédito creado correctamente'
        });
        this.cerrarModales();
        this.cargarCreditos();
        this.cargarResumenCreditos();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al crear crédito:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al crear el crédito'
        });
        this.loading = false;
      }
    });
  }

  pagarCuota() {
    if (this.pagoCuota.montoPagado <= 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Ingrese el monto a pagar'
      });
      return;
    }

    this.loading = true;
    const payload: any = {
      idCuota: this.pagoCuota.idCuota,
      montoPagado: this.pagoCuota.montoPagado,
      formaPago: this.pagoCuota.formaPago,
      referencia: this.pagoCuota.referencia,
      observaciones: this.pagoCuota.observaciones,
      fechaPago: fechaHoraVentaClienteAhora()
    };
    if (this.pagoCuota.idMediosPago != null) payload.idMediosPago = this.pagoCuota.idMediosPago;
    if (this.pagoCuota.idApertura) payload.idApertura = this.pagoCuota.idApertura;
    payload.idEmpresaOperacion = this.creditoSeleccionado
      ? this.idEmpresaDelCredito(this.creditoSeleccionado)
      : this.idEmpresaOpRegistro();

    this.creditosService.pagarCuota(payload).subscribe({
      next: (response) => {
        const comprobante = (response?.data?.numeroRecibo || '').toString().trim();
        const msg = comprobante
          ? 'Pago registrado. Comprobante de cobranza: Recibo de Ingreso ' + comprobante + '. El monto se refleja en el arqueo de caja.'
          : 'Pago registrado correctamente.';
        iziToast.success({ title: 'Éxito', message: msg });
        this.cerrarModales();
        if (this.creditoSeleccionado) {
          this.creditosService
            .obtenerCuotasCredito(this.creditoSeleccionado.idCredito, this.idEmpresaDelCredito(this.creditoSeleccionado))
            .subscribe({
            next: (resp) => { this.cuotas = resp.data || []; }
          });
        }
        this.cargarCreditos();
        this.cargarResumenCreditos();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al pagar cuota:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al registrar el pago'
        });
        this.loading = false;
      }
    });
  }

  filtrarCreditos() {
    this.cargarCreditos();
  }

  limpiarFiltros() {
    this.filtros = {
      idCliente: '',
      estado: '',
      fechaDesde: '',
      fechaHasta: '',
      numero: '',
      buscar: ''
    };
    this.cargarCreditos();
  }

  getClienteNombre(idCliente: string | number): string {
    const id = idCliente != null ? String(idCliente) : '';
    const cliente = this.clientes.find(c => String(c.idCliente) === id);
    return cliente ? cliente.rSocial || `${cliente.nombre} ${cliente.apellido || ''}`.trim() : 'Cliente no encontrado';
  }

  nombreEmpresaCredito(idEmp?: string): string {
    if (!idEmp) return '—';
    const e = this.empresasOperacion.find((x) => String(x.idEmpresa) === String(idEmp));
    return e ? (e.razonSocial || e.ruc || idEmp) : String(idEmp).slice(0, 13);
  }

  getEstadoBadgeClass(estado: string): string {
    switch (estado) {
      case 'ACTIVO': return 'bg-success';
      case 'COMPLETADO': return 'bg-primary';
      case 'CANCELADO': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  getEstadoCuotaBadgeClass(estado: string): string {
    switch (estado) {
      case 'PAGADO': return 'bg-success';
      case 'PENDIENTE': return 'bg-warning';
      case 'VENCIDO': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  calcularMontoCuota(): number {
    if (this.nuevoCredito.montoTotal <= 0 || this.nuevoCredito.numeroCuotas < 1) {
      return 0;
    }

    const montoConInteres = this.nuevoCredito.montoTotal * (1 + this.nuevoCredito.interes / 100);
    const montoSinCuotaInicial = montoConInteres - this.nuevoCredito.cuotaInicial;

    return montoSinCuotaInicial / this.nuevoCredito.numeroCuotas;
  }
}