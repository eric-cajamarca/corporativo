import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { SucursalService } from '../../../services/sucursal.service';
import { Caja, MovimientoCaja, TipoMovimientoCaja } from '../../../interfaces/caja-interface';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { fechaHoraVentaClienteAhora, formatFechaHoraApiParaMostrar } from '../../../utils/fecha-local.util';

declare var iziToast: any;

@Component({
  selector: 'app-index-caja',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './index-caja.component.html',
  styleUrl: './index-caja.component.css'
})
export class IndexCajaComponent implements OnInit {
  public cajas: Caja[] = [];
  public sucursales: Sucursal[] = [];
  public movimientos: MovimientoCaja[] = [];
  public tiposMovimiento: TipoMovimientoCaja[] = [];

  public cajaSeleccionada: Caja | null = null;
  public mostrarModalApertura = false;
  public mostrarModalMovimiento = false;
  public mostrarModalCierre = false;
  public mostrarModalNuevaCaja = false;

  public nuevaCaja = {
    idSucursal: '',
    nombre: '',
    descripcion: ''
  };

  public montoInicial = 0;
  /** Monto contado al cierre; vacío = backend usa saldo teórico */
  public montoCierre: number | null = null;
  public movimiento = {
    idTipoMovimientoCaja: 0,
    descripcion: '',
    monto: 0,
    idMedioPago: '',
    referencia: ''
  };

  public filtrosMovimientos = {
    idCaja: '',
    fechaDesde: '',
    fechaHasta: '',
    idTipoMovimientoCaja: 0
  };

  public loading = false;

  page = 1;
  pageSize = 10;
  get totalItems(): number {
    return this.movimientos.length;
  }
  get movimientosPaginated(): MovimientoCaja[] {
    const start = (this.page - 1) * this.pageSize;
    return this.movimientos.slice(start, start + this.pageSize);
  }

  get mostrarColumnaEmpresaMovimiento(): boolean {
    return this.movimientos.some((m) => !!m.empresaMovimiento);
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

  formatFechaMovimiento(valor: string | null | undefined): string {
    return formatFechaHoraApiParaMostrar(valor) || '—';
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
    private sucursalService: SucursalService,
    private route: ActivatedRoute,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarCajas();
    this.cargarTiposMovimiento();
    this.cargarSucursales();
    this.route.queryParamMap.subscribe((params) => {
      const modo = params.get('onboarding');
      if (modo === 'nueva') {
        this.abrirModalNuevaCaja();
      }
    });
  }

  cargarSucursales() {
    this.sucursalService.obtener_sucursal_idempresa().subscribe({
      next: (response) => {
        if (response?.data) {
          this.sucursales = Array.isArray(response.data) ? response.data : [];
        }
      },
      error: (err) => {
        this.sucursales = [];
      }
    });
  }

  cargarCajas() {
    this.loading = true;
    this.cajaService.obtenerCajas().subscribe({
      next: (response) => {
        const data = response?.data ?? response;
        this.cajas = Array.isArray(data) ? data : [];
        this.loading = false;
        this.aplicarOnboardingDesdeQuery();
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: error?.error?.message || 'Error al cargar las cajas'
        });
        this.cajas = [];
        this.loading = false;
      }
    });
  }

  private aplicarOnboardingDesdeQuery(): void {
    const modo = this.route.snapshot.queryParamMap.get('onboarding');
    if (modo !== 'apertura') return;
    const candidata = this.cajas.find((c) => !c.cajaAbierta) ?? this.cajas[0];
    if (candidata) {
      this.abrirModalApertura(candidata);
    }
  }

  cargarTiposMovimiento() {
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (response) => {
        if (response.data) {
          this.tiposMovimiento = response.data;
        }
      },
      error: (error) => {
      }
    });
  }

  cargarMovimientos() {
    if (!this.filtrosMovimientos.idCaja) return;

    const idTipo = this.filtrosMovimientos.idTipoMovimientoCaja;
    const tipoMovimiento = idTipo && this.tiposMovimiento.length
      ? (this.tiposMovimiento.find(t => t.idTipoMovimientoCaja === idTipo)?.tipo || undefined)
      : undefined;
    const filtros: any = {
      idCaja: this.filtrosMovimientos.idCaja,
      fechaDesde: this.filtrosMovimientos.fechaDesde || undefined,
      fechaHasta: this.filtrosMovimientos.fechaHasta || undefined
    };
    if (tipoMovimiento) filtros.tipoMovimiento = tipoMovimiento;

    this.loading = true;
    this.cajaService.obtenerMovimientos(filtros).subscribe({
      next: (response) => {
        if (response.data) {
          this.movimientos = response.data;
        }
        this.page = 1;
        this.loading = false;
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar los movimientos'
        });
        this.loading = false;
      }
    });
  }

  seleccionarCaja(caja: Caja) {
    this.cajaSeleccionada = caja;
    this.filtrosMovimientos.idCaja = caja.idCaja;
    this.cargarMovimientos();
  }

  abrirModalApertura(caja: Caja) {
    this.cajaSeleccionada = caja;
    this.montoInicial = 0;
    this.mostrarModalApertura = true;
  }

  abrirModalMovimiento(caja: Caja) {
    if (!caja.cajaAbierta || !caja.idApertura) {
      iziToast.warning({
        title: 'Caja cerrada',
        message: 'Debe abrir la caja antes de registrar movimientos'
      });
      return;
    }
    this.cajaSeleccionada = caja;
    this.movimiento = {
      idTipoMovimientoCaja: 0,
      descripcion: '',
      monto: 0,
      idMedioPago: '',
      referencia: ''
    };
    this.mostrarModalMovimiento = true;
  }

  abrirModalCierre(caja: Caja) {
    if (!caja.cajaAbierta || !caja.idApertura) {
      iziToast.warning({
        title: 'Caja cerrada',
        message: 'No hay apertura activa para cerrar'
      });
      return;
    }
    this.cajaSeleccionada = caja;
    this.filtrosMovimientos.idCaja = caja.idCaja;
    this.montoCierre = null;
    this.mostrarModalCierre = true;
    this.cargarMovimientos();
  }

  get saldoEsperadoCierre(): number {
    const inicial = Number(this.cajaSeleccionada?.montoInicial) || 0;
    let ingresos = 0;
    let egresos = 0;
    for (const m of this.movimientos) {
      const t = String(m.tipoOperacion || m.tipoMovimiento || '').toUpperCase();
      const monto = Number(m.monto) || 0;
      if (t === 'I' || t === 'INGRESO') ingresos += monto;
      else if (t === 'E' || t === 'EGRESO') egresos += monto;
    }
    return Math.round((inicial + ingresos - egresos) * 100) / 100;
  }

  get diferenciaCierrePreview(): number {
    const contado = this.montoCierre != null && !Number.isNaN(this.montoCierre)
      ? Number(this.montoCierre)
      : this.saldoEsperadoCierre;
    return Math.round((contado - this.saldoEsperadoCierre) * 100) / 100;
  }

  cerrarModales() {
    this.mostrarModalApertura = false;
    this.mostrarModalMovimiento = false;
    this.mostrarModalCierre = false;
    this.mostrarModalNuevaCaja = false;
    this.cajaSeleccionada = null;
  }

  abrirModalNuevaCaja() {
    this.nuevaCaja = { idSucursal: '', nombre: '', descripcion: '' };
    this.mostrarModalNuevaCaja = true;
    this.cargarSucursales();
  }

  registrarNuevaCaja() {
    if (!this.nuevaCaja.idSucursal || !this.nuevaCaja.nombre?.trim()) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Seleccione sucursal e ingrese el nombre de la caja'
      });
      return;
    }
    this.loading = true;
    this.cajaService.crearCaja({
      idSucursal: this.nuevaCaja.idSucursal,
      nombre: this.nuevaCaja.nombre.trim(),
      descripcion: this.nuevaCaja.descripcion?.trim() || undefined
    }).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Caja registrada correctamente' });
        this.cerrarModales();
        this.cargarCajas();
        this.loading = false;
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al registrar la caja'
        });
        this.loading = false;
      }
    });
  }

  abrirCaja() {
    if (!this.cajaSeleccionada || this.montoInicial <= 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Debe seleccionar una caja y ingresar un monto inicial válido'
      });
      return;
    }

    this.loading = true;
    this.cajaService.abrirCaja({
      idCaja: this.cajaSeleccionada.idCaja,
      montoInicial: this.montoInicial,
      fechaApertura: fechaHoraVentaClienteAhora()
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Caja abierta correctamente'
        });
        this.cerrarModales();
        this.cargarCajas();
        this.loading = false;
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al abrir la caja'
        });
        this.loading = false;
      }
    });
  }

  registrarMovimiento() {
    const idTipo = Number(this.movimiento.idTipoMovimientoCaja);
    if (!this.cajaSeleccionada?.idApertura || !idTipo ||
        !this.movimiento.descripcion?.trim() || this.movimiento.monto <= 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Complete todos los campos requeridos (la caja debe estar abierta)'
      });
      return;
    }

    const idMediosRaw = this.movimiento.idMedioPago;
    const idMediosPago =
      idMediosRaw !== '' && idMediosRaw != null && !Number.isNaN(Number(idMediosRaw))
        ? Number(idMediosRaw)
        : undefined;

    this.loading = true;
    this.cajaService.registrarMovimiento({
      idApertura: this.cajaSeleccionada.idApertura,
      idTipoMovimientoCaja: idTipo,
      concepto: this.movimiento.descripcion.trim(),
      monto: this.movimiento.monto,
      idMediosPago,
      observaciones: this.movimiento.referencia?.trim() || undefined,
      fechaMovimiento: fechaHoraVentaClienteAhora()
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Movimiento registrado correctamente'
        });
        this.cerrarModales();
        this.cargarMovimientos();
        this.loading = false;
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al registrar el movimiento'
        });
        this.loading = false;
      }
    });
  }

  cerrarCaja() {
    if (!this.cajaSeleccionada?.idApertura) {
      iziToast.warning({ title: 'Advertencia', message: 'No hay apertura activa para cerrar' });
      return;
    }

    this.loading = true;
    const payload: { idApertura: string; montoFinal?: number; fechaCierre?: string } = {
      idApertura: this.cajaSeleccionada.idApertura,
      fechaCierre: fechaHoraVentaClienteAhora()
    };
    if (this.montoCierre != null && !Number.isNaN(this.montoCierre)) {
      payload.montoFinal = this.montoCierre;
    }
    this.cajaService.cerrarCaja(payload).subscribe({
      next: (response) => {
        const d = response?.data || {};
        const diferencia = Number(d.diferencia);
        const esperado = Number(d.saldoEsperado);
        const contado = Number(d.montoFinal);
        let extra = '';
        if (Number.isFinite(diferencia)) {
          if (Math.abs(diferencia) < 0.01) {
            extra = ' Sin diferencia (contado = esperado).';
          } else if (diferencia > 0) {
            extra = ` Sobrante S/ ${diferencia.toFixed(2)} (contado ${contado.toFixed(2)} vs esperado ${esperado.toFixed(2)}).`;
          } else {
            extra = ` Faltante S/ ${Math.abs(diferencia).toFixed(2)} (contado ${contado.toFixed(2)} vs esperado ${esperado.toFixed(2)}).`;
          }
        }
        iziToast.success({
          title: 'Caja cerrada',
          message: 'Caja cerrada correctamente.' + extra
        });
        this.cerrarModales();
        this.cargarCajas();
        this.loading = false;
      },
      error: (error) => {
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al cerrar la caja'
        });
        this.loading = false;
      }
    });
  }

  getTipoMovimientoNombre(idTipo: number | undefined): string {
    if (idTipo == null) return 'Desconocido';
    const tipo = this.tiposMovimiento.find(t => t.idTipoMovimientoCaja === idTipo);
    const raw = tipo?.nombre || '';
    const etiquetas: Record<string, string> = {
      VENTA_CONTADO: 'Venta al contado',
      VENTA_CREDITO: 'Venta a crédito',
      COBRANZA_CREDITO: 'Cobranza de crédito',
      APERTURA_CAJA: 'Apertura de caja',
      CIERRE_CAJA: 'Cierre de caja'
    };
    if (etiquetas[raw]) return etiquetas[raw];
    return raw ? raw.replace(/_/g, ' ') : 'Desconocido';
  }
}