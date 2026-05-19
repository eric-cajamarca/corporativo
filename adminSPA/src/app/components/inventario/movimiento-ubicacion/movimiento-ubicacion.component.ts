import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LotesUbicacionService,
  LoteTrasladable,
  ProductoTrasladoUbicacion
} from '../../../services/lotes-ubicacion.service';
import { LotesService } from '../../../services/lotes.service';
import { SucursalService } from '../../../services/sucursal.service';
import { GestoresService } from '../../../services/gestores.service';
import { Sucursal } from '../../../interfaces/sucursal-interface';
import { UbicacionPrioridadService } from '../../../services/ubicacion-prioridad.service';
import { marcaProductoEnLista } from '../../../utils/producto-busqueda.util';

declare const iziToast: { success: (o: object) => void; error: (o: object) => void; show: (o: object) => void };

interface UbicacionLoteRow {
  idUbicacion: number;
  codigoUbicacion: string;
  prioridad?: number;
  cantidad: number;
}

@Component({
  selector: 'app-movimiento-ubicacion',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './movimiento-ubicacion.component.html',
  styleUrl: './movimiento-ubicacion.component.css'
})
export class MovimientoUbicacionComponent implements OnInit {
  @Input() idLote: string | null = null;

  movimientoForm: FormGroup;

  sucursales: Sucursal[] = [];
  idSucursalSeleccionada = '';
  esModoGestora = false;

  buscarProducto = '';
  productosResultado: ProductoTrasladoUbicacion[] = [];
  productoSeleccionado: ProductoTrasladoUbicacion | null = null;
  lotesProducto: LoteTrasladable[] = [];
  loteSeleccionado: LoteTrasladable | null = null;

  ubicacionesOrigen: UbicacionLoteRow[] = [];
  ubicacionesDestino: UbicacionLoteRow[] = [];

  cargandoSucursales = true;
  cargandoBusqueda = false;
  cargandoLotes = false;
  cargandoUbicaciones = false;
  ejecutando = false;

  stockDisponibleOrigen = 0;
  paso: 'producto' | 'lote' | 'traslado' = 'producto';

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private loteService: LotesService,
    private loteUbicacionService: LotesUbicacionService,
    private sucursalService: SucursalService,
    private gestoresService: GestoresService,
    private ubicacionPrioridadService: UbicacionPrioridadService
  ) {
    this.movimientoForm = this.fb.group({
      idUbicacionOrigen: ['', Validators.required],
      idUbicacionDestino: ['', Validators.required],
      cantidad: [null, [Validators.required, Validators.min(0.001)]]
    });
  }

  ngOnInit(): void {
    this.cargarSucursales();
    if (this.idLote) {
      this.cargarDesdeLotePrecargado(this.idLote);
    }
  }

  private cargarSucursales(): void {
    this.cargandoSucursales = true;
    this.gestoresService.obtenerEmpresasGestionadas().subscribe({
      next: (res) => {
        const arr = Array.isArray(res?.data) ? res.data : [];
        this.esModoGestora = arr.length > 0;
        this.sucursalService.obtener_sucursal_todos().subscribe({
          next: (sucRes) => {
            const raw = sucRes?.data ?? sucRes;
            this.sucursales = Array.isArray(raw) ? raw : [];
            this.aplicarSucursalPorDefecto();
            this.cargandoSucursales = false;
          },
          error: () => {
            this.cargandoSucursales = false;
          }
        });
      },
      error: () => {
        this.esModoGestora = false;
        this.sucursalService.obtener_sucursal_todos().subscribe({
          next: (sucRes) => {
            const raw = sucRes?.data ?? sucRes;
            this.sucursales = Array.isArray(raw) ? raw : [];
            this.aplicarSucursalPorDefecto();
            this.cargandoSucursales = false;
          },
          error: () => {
            this.cargandoSucursales = false;
          }
        });
      }
    });
  }

  private cargarDesdeLotePrecargado(idLote: string): void {
    this.loteService.obtener_lote_id(idLote).subscribe({
      next: (res) => {
        const lote = res?.data ?? res;
        if (!lote?.idLote) {
          return;
        }
        if (lote.idSucursal) {
          this.idSucursalSeleccionada = String(lote.idSucursal);
        }
        this.loteSeleccionado = {
          idLote: lote.idLote,
          idProducto: lote.idProducto,
          idSucursal: lote.idSucursal,
          numeroLote: lote.numeroLote,
          cantidadDisponible: Number(lote.cantidadDisponible) || 0,
          stockEnUbicaciones: 0
        };
        this.productoSeleccionado = {
          idProducto: lote.idProducto,
          idEmpresa: lote.idEmpresa,
          codigoProducto: '',
          nombreProducto: 'Lote seleccionado',
          stockEnUbicaciones: 0
        };
        this.paso = 'traslado';
        this.onLoteSeleccionado();
      },
      error: () => {
        iziToast.error({ title: 'Error', message: 'No se pudo cargar el lote', position: 'topRight' });
      }
    });
  }

  private aplicarSucursalPorDefecto(): void {
    if (this.esModoGestora) {
      this.idSucursalSeleccionada = '';
      return;
    }
    if (this.sucursales.length > 0 && !this.idSucursalSeleccionada) {
      this.idSucursalSeleccionada = String(this.sucursales[0].idSucursal || '');
    }
  }

  buscarProductos(): void {
    if (!this.esModoGestora && !this.idSucursalSeleccionada?.trim()) {
      iziToast.error({ title: 'Validación', message: 'Seleccione una sucursal', position: 'topRight' });
      return;
    }
    this.cargandoBusqueda = true;
    this.productoSeleccionado = null;
    this.lotesProducto = [];
    this.loteSeleccionado = null;
    this.paso = 'producto';
    this.loteUbicacionService
      .buscarProductosTraslado({
        buscar: this.buscarProducto?.trim() || null,
        idSucursal: this.idSucursalSeleccionada || null,
        restringirSucursal: !this.esModoGestora
      })
      .subscribe({
        next: (res) => {
          this.productosResultado = res.items || [];
          this.cargandoBusqueda = false;
        },
        error: (err) => {
          this.cargandoBusqueda = false;
          this.productosResultado = [];
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'Error al buscar productos',
            position: 'topRight'
          });
        }
      });
  }

  elegirProducto(p: ProductoTrasladoUbicacion): void {
    this.productoSeleccionado = p;
    this.loteSeleccionado = null;
    this.paso = 'lote';
    this.cargarLotesProducto();
  }

  private cargarLotesProducto(): void {
    if (!this.productoSeleccionado) {
      return;
    }
    this.cargandoLotes = true;
    this.lotesProducto = [];
    this.loteUbicacionService
      .listarLotesTrasladables(
        this.productoSeleccionado.idProducto,
        this.idSucursalSeleccionada || null,
        !this.esModoGestora
      )
      .subscribe({
        next: (res) => {
          this.lotesProducto = res.lotes || [];
          this.cargandoLotes = false;
          if (this.lotesProducto.length === 1) {
            this.elegirLote(this.lotesProducto[0]);
          }
        },
        error: (err) => {
          this.cargandoLotes = false;
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'No se pudieron cargar los lotes',
            position: 'topRight'
          });
        }
      });
  }

  elegirLote(lote: LoteTrasladable): void {
    this.loteSeleccionado = lote;
    this.paso = 'traslado';
    this.movimientoForm.reset({ idUbicacionOrigen: '', idUbicacionDestino: '', cantidad: null });
    this.onLoteSeleccionado();
  }

  volverABuscarProducto(): void {
    this.paso = 'producto';
    this.productoSeleccionado = null;
    this.lotesProducto = [];
    this.loteSeleccionado = null;
    this.ubicacionesOrigen = [];
    this.ubicacionesDestino = [];
    this.stockDisponibleOrigen = 0;
  }

  volverALotes(): void {
    this.paso = 'lote';
    this.loteSeleccionado = null;
    this.ubicacionesOrigen = [];
    this.ubicacionesDestino = [];
    this.stockDisponibleOrigen = 0;
    this.movimientoForm.reset({ idUbicacionOrigen: '', idUbicacionDestino: '', cantidad: null });
  }

  onLoteSeleccionado(): void {
    const idLote = this.loteSeleccionado?.idLote;
    if (!idLote) {
      this.ubicacionesOrigen = [];
      this.ubicacionesDestino = [];
      return;
    }

    this.cargandoUbicaciones = true;
    this.movimientoForm.patchValue({ idUbicacionOrigen: '', idUbicacionDestino: '', cantidad: null });
    this.stockDisponibleOrigen = 0;

    this.loteUbicacionService.obtener_ubicacionLote_idLote(idLote).subscribe({
      next: (response: { data?: UbicacionLoteRow[] }) => {
        const data = response.data ?? (response as unknown as UbicacionLoteRow[]);
        const filas = (Array.isArray(data) ? data : []).filter((u) => Number(u.cantidad) > 0);
        this.ubicacionesOrigen = filas;
        this.ubicacionesDestino = [];
        this.cargandoUbicaciones = false;
        this.actualizarEstadoControles();
      },
      error: () => {
        this.cargandoUbicaciones = false;
        iziToast.error({
          title: 'Error',
          message: 'Error al cargar ubicaciones del lote',
          position: 'topRight'
        });
      }
    });
  }

  onUbicacionOrigenSeleccionada(): void {
    const idUbicacionOrigen = Number(this.movimientoForm.get('idUbicacionOrigen')?.value);
    if (!idUbicacionOrigen) {
      this.stockDisponibleOrigen = 0;
      this.ubicacionesDestino = [];
      this.actualizarEstadoControles();
      return;
    }
    const ubicacion = this.ubicacionesOrigen.find((u) => u.idUbicacion === idUbicacionOrigen);
    this.stockDisponibleOrigen = Number(ubicacion?.cantidad) || 0;
    this.cargarDestinosExcluyendoOrigen(idUbicacionOrigen);
    const cantidadActual = Number(this.movimientoForm.get('cantidad')?.value) || 0;
    if (cantidadActual > this.stockDisponibleOrigen) {
      this.movimientoForm.patchValue({ cantidad: this.stockDisponibleOrigen });
    }
    this.actualizarEstadoControles();
  }

  private cargarDestinosExcluyendoOrigen(idUbicacionOrigen: number): void {
    const idSucursal = this.loteSeleccionado?.idSucursal;
    if (!idSucursal) {
      return;
    }
    this.ubicacionPrioridadService.obtener_ubicacionesPrioridad_sucursal(idSucursal).subscribe({
      next: (ubicaciones: { data?: UbicacionLoteRow[] } | UbicacionLoteRow[]) => {
        const ubicacionesData = Array.isArray(ubicaciones)
          ? ubicaciones
          : Array.isArray(ubicaciones?.data)
            ? ubicaciones.data
            : [];
        this.ubicacionesDestino = ubicacionesData.filter((u) => u.idUbicacion !== idUbicacionOrigen);
        this.actualizarEstadoControles();
      }
    });
  }

  validarCantidad(): void {
    const cantidad = Number(this.movimientoForm.get('cantidad')?.value) || 0;
    if (cantidad > this.stockDisponibleOrigen) {
      this.movimientoForm.patchValue({ cantidad: this.stockDisponibleOrigen });
      iziToast.show({
        title: 'Advertencia',
        titleColor: '#ffc107',
        message: `La cantidad máxima disponible es ${this.stockDisponibleOrigen}`,
        position: 'topRight'
      });
    }
  }

  ejecutarMovimiento(): void {
    if (!this.loteSeleccionado || this.movimientoForm.invalid) {
      this.marcarCamposComoTocados();
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'Complete todos los campos requeridos',
        position: 'topRight'
      });
      return;
    }

    const idLote = this.loteSeleccionado.idLote;
    const idUbicacionOrigen = Number(this.movimientoForm.get('idUbicacionOrigen')?.value);
    const idUbicacionDestino = Number(this.movimientoForm.get('idUbicacionDestino')?.value);
    const cantidad = Number(this.movimientoForm.get('cantidad')?.value);

    if (idUbicacionOrigen === idUbicacionDestino) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: 'La ubicación origen y destino deben ser diferentes',
        position: 'topRight'
      });
      return;
    }

    if (cantidad > this.stockDisponibleOrigen) {
      iziToast.show({
        title: 'Validación',
        titleColor: '#ffc107',
        message: `No hay suficiente stock. Disponible: ${this.stockDisponibleOrigen}`,
        position: 'topRight'
      });
      return;
    }

    this.ejecutando = true;
    this.actualizarEstadoControles();

    this.loteUbicacionService
      .trasladoEntreUbicaciones({
        idLote,
        idUbicacionOrigen,
        idUbicacionDestino,
        cantidad
      })
      .subscribe({
        next: (res) => {
          this.ejecutando = false;
          iziToast.success({
            title: 'Éxito',
            message: res.message || `Traslado de ${cantidad} unidades ejecutado`,
            position: 'topRight'
          });
          this.activeModal.close({ success: true, cantidad, idLote });
        },
        error: (err) => {
          this.ejecutando = false;
          this.actualizarEstadoControles();
          iziToast.error({
            title: 'Error',
            message: err?.error?.message || 'Error al ejecutar el traslado',
            position: 'topRight'
          });
        }
      });
  }

  marcaColumna(p: ProductoTrasladoUbicacion): string {
    return marcaProductoEnLista(p as unknown as Record<string, unknown>);
  }

  private marcarCamposComoTocados(): void {
    Object.keys(this.movimientoForm.controls).forEach((key) => {
      this.movimientoForm.get(key)?.markAsTouched();
    });
  }

  hasError(field: string): boolean {
    const control = this.movimientoForm.get(field);
    return !!(control?.invalid && control?.touched);
  }

  actualizarEstadoControles(): void {
    const idOrigen = this.movimientoForm.get('idUbicacionOrigen')?.value;
    const cOrigen = this.movimientoForm.get('idUbicacionOrigen');
    const cDestino = this.movimientoForm.get('idUbicacionDestino');
    const cCantidad = this.movimientoForm.get('cantidad');
    if (this.ejecutando) {
      cOrigen?.disable();
      cDestino?.disable();
      cCantidad?.disable();
    } else {
      cOrigen?.enable();
      cDestino?.enable();
      cCantidad?.enable();
      if (this.ubicacionesOrigen.length === 0) {
        cOrigen?.disable();
      }
      if (this.ubicacionesDestino.length === 0 || !idOrigen) {
        cDestino?.disable();
      }
      if (this.stockDisponibleOrigen === 0) {
        cCantidad?.disable();
      }
    }
  }

  get codigoUbicacionOrigen(): string {
    const id = Number(this.movimientoForm.get('idUbicacionOrigen')?.value);
    const u = this.ubicacionesOrigen.find((x) => x.idUbicacion === id);
    return u?.codigoUbicacion ?? '';
  }

  get codigoUbicacionDestino(): string {
    const id = Number(this.movimientoForm.get('idUbicacionDestino')?.value);
    const u = this.ubicacionesDestino.find((x) => x.idUbicacion === id);
    return u?.codigoUbicacion ?? '';
  }

  cancelar(): void {
    this.activeModal.dismiss();
  }
}
