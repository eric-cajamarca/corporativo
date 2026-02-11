import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CreditosService } from '../../../services/creditos.service';
import { ClienteService } from '../../../services/cliente.service';
import { CreditoCliente, CuotaCredito, ResumenCreditos } from '../../../interfaces/creditos-interface';
import { Cliente } from '../../../interfaces/cliente-interface';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';

declare var iziToast: any;

@Component({
  selector: 'app-index-creditos',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule, SidebarComponent, TopnavComponent],
  templateUrl: './index-creditos.component.html',
  styleUrl: './index-creditos.component.css'
})
export class IndexCreditosComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);

  public creditos: CreditoCliente[] = [];
  public cuotas: CuotaCredito[] = [];
  public clientes: Cliente[] = [];
  public resumenCreditos: ResumenCreditos | null = null;

  public creditoSeleccionado: CreditoCliente | null = null;
  public clienteSeleccionado: Cliente | null = null;

  public mostrarModalNuevoCredito = false;
  public mostrarModalPagarCuota = false;
  public mostrarCuotas = false;

  public nuevoCredito = {
    idCliente: '',
    idVenta: '',
    montoTotal: 0,
    interes: 0,
    numeroCuotas: 1,
    cuotaInicial: 0
  };

  public pagoCuota = {
    idCuota: '',
    montoPagado: 0,
    formaPago: '',
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

  constructor(
    private creditosService: CreditosService,
    private clienteService: ClienteService
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarResumenCreditos();
    this.cargarCreditos();
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') this.sidebarCollapsed.set(true);
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  cargarClientes() {
    this.clienteService.obtener_clientes().subscribe({
      next: (response) => {
        if (response.clientes) {
          this.clientes = response.clientes;
        }
      },
      error: (error) => {
        console.error('Error al cargar clientes:', error);
      }
    });
  }

  cargarCreditos() {
    this.loading = true;
    this.creditosService.obtenerCreditosCliente(this.filtros.idCliente || '').subscribe({
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

  buscar() {
    this.cargarCreditos();
  }

  getPagado(credito: CreditoCliente): number {
    if (credito.totalPagado != null) return credito.totalPagado;
    const saldo = credito.saldoPendiente ?? 0;
    return Math.max(0, (credito.montoTotal || 0) - saldo);
  }

  cargarResumenCreditos() {
    this.creditosService.obtenerResumenCreditos().subscribe({
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
    this.creditosService.obtenerCuotasCredito(credito.idCredito).subscribe({
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
      montoPagado: cuota.saldoPendiente,
      formaPago: '',
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
    this.creditosService.crearCredito(this.nuevoCredito).subscribe({
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
    if (!this.pagoCuota.formaPago || this.pagoCuota.montoPagado <= 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Complete todos los campos requeridos'
      });
      return;
    }

    this.loading = true;
    this.creditosService.pagarCuota(this.pagoCuota).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Pago registrado correctamente'
        });
        this.cerrarModales();
        if (this.creditoSeleccionado) {
          this.creditosService.obtenerCuotasCredito(this.creditoSeleccionado.idCredito).subscribe({
            next: (response) => { this.cuotas = response.data || []; }
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

  getClienteNombre(idCliente: string): string {
    const cliente = this.clientes.find(c => c.idCliente === idCliente);
    return cliente ? cliente.rSocial || `${cliente.nombre} ${cliente.apellido || ''}`.trim() : 'Cliente no encontrado';
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