import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajaService } from '../../../services/caja.service';
import { Caja, MovimientoCaja, TipoMovimientoCaja } from '../../../interfaces/caja-interface';
import { TopnavComponent } from '../../topnav/topnav.component';

declare var iziToast: any;

@Component({
  selector: 'app-index-caja',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent],
  templateUrl: './index-caja.component.html',
  styleUrl: './index-caja.component.css'
})
export class IndexCajaComponent implements OnInit {

  public cajas: Caja[] = [];
  public movimientos: MovimientoCaja[] = [];
  public tiposMovimiento: TipoMovimientoCaja[] = [];

  public cajaSeleccionada: Caja | null = null;
  public mostrarModalApertura = false;
  public mostrarModalMovimiento = false;
  public mostrarModalCierre = false;

  public montoInicial = 0;
  public movimiento = {
    idTipoMovimiento: 0,
    descripcion: '',
    monto: 0,
    idMedioPago: '',
    referencia: ''
  };

  public filtrosMovimientos = {
    idCaja: '',
    fechaDesde: '',
    fechaHasta: '',
    idTipoMovimiento: 0
  };

  public loading = false;

  constructor(
    private cajaService: CajaService
  ) {}

  ngOnInit(): void {
    this.cargarCajas();
    this.cargarTiposMovimiento();
  }

  cargarCajas() {
    this.loading = true;
    this.cajaService.obtenerCajas().subscribe({
      next: (response) => {
        if (response.data) {
          this.cajas = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar cajas:', error);
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar las cajas'
        });
        this.loading = false;
      }
    });
  }

  cargarTiposMovimiento() {
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (response) => {
        if (response.data) {
          this.tiposMovimiento = response.data;
        }
      },
      error: (error) => {
        console.error('Error al cargar tipos de movimiento:', error);
      }
    });
  }

  cargarMovimientos() {
    if (!this.filtrosMovimientos.idCaja) return;

    this.loading = true;
    this.cajaService.obtenerMovimientos(this.filtrosMovimientos).subscribe({
      next: (response) => {
        if (response.data) {
          this.movimientos = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar movimientos:', error);
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
    this.cajaSeleccionada = caja;
    this.movimiento = {
      idTipoMovimiento: 0,
      descripcion: '',
      monto: 0,
      idMedioPago: '',
      referencia: ''
    };
    this.mostrarModalMovimiento = true;
  }

  abrirModalCierre(caja: Caja) {
    this.cajaSeleccionada = caja;
    this.mostrarModalCierre = true;
  }

  cerrarModales() {
    this.mostrarModalApertura = false;
    this.mostrarModalMovimiento = false;
    this.mostrarModalCierre = false;
    this.cajaSeleccionada = null;
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
      montoInicial: this.montoInicial
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
        console.error('Error al abrir caja:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al abrir la caja'
        });
        this.loading = false;
      }
    });
  }

  registrarMovimiento() {
    if (!this.cajaSeleccionada || !this.movimiento.idTipoMovimiento ||
        !this.movimiento.descripcion || this.movimiento.monto <= 0) {
      iziToast.warning({
        title: 'Advertencia',
        message: 'Complete todos los campos requeridos'
      });
      return;
    }

    this.loading = true;
    this.cajaService.registrarMovimiento({
      idCaja: this.cajaSeleccionada.idCaja,
      idTipoMovimiento: this.movimiento.idTipoMovimiento,
      descripcion: this.movimiento.descripcion,
      monto: this.movimiento.monto,
      idMedioPago: this.movimiento.idMedioPago || undefined,
      referencia: this.movimiento.referencia || undefined
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
        console.error('Error al registrar movimiento:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al registrar el movimiento'
        });
        this.loading = false;
      }
    });
  }

  cerrarCaja() {
    if (!this.cajaSeleccionada) return;

    this.loading = true;
    this.cajaService.cerrarCaja({
      idCaja: this.cajaSeleccionada.idCaja
    }).subscribe({
      next: (response) => {
        iziToast.success({
          title: 'Éxito',
          message: 'Caja cerrada correctamente'
        });
        this.cerrarModales();
        this.cargarCajas();
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cerrar caja:', error);
        iziToast.error({
          title: 'Error',
          message: error.error?.message || 'Error al cerrar la caja'
        });
        this.loading = false;
      }
    });
  }

  getTipoMovimientoNombre(idTipo: number): string {
    const tipo = this.tiposMovimiento.find(t => t.idTipoMovimiento === idTipo);
    return tipo ? tipo.nombre : 'Desconocido';
  }
}