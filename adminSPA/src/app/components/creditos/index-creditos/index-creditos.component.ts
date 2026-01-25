import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CreditosService } from '../../../services/creditos.service';
import { ClienteService } from '../../../services/cliente.service';
import { CreditoCliente, CuotaCredito, ResumenCreditos } from '../../../interfaces/creditos-interface';
import { Cliente } from '../../../interfaces/cliente-interface';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

@Component({
  selector: 'app-index-creditos',
  imports: [FormsModule, RouterModule, CommonModule],
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
    fechaHasta: ''
  };

  public loading = false;

  constructor(
    private creditosService: CreditosService,
    private clienteService: ClienteService
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarResumenCreditos();
    this.cargarCreditos();
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
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar créditos:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar los créditos'
        });
        this.loading = false;
      }
    });
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

  verCuotas(credito: CreditoCliente) {
    this.creditoSeleccionado = credito;
    this.loading = true;

    this.creditosService.obtenerCuotasCredito(credito.idCredito).subscribe({
      next: (response) => {
        if (response.data) {
          this.cuotas = response.data;
          this.mostrarCuotas = true;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar cuotas:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar las cuotas'
        });
        this.loading = false;
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
    this.mostrarCuotas = false;
    this.creditoSeleccionado = null;
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
          this.verCuotas(this.creditoSeleccionado);
        }
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
      fechaHasta: ''
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