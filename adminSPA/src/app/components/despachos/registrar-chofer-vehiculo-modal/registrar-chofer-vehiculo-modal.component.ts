import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { VehiculosService, VehiculoRegistro } from '../../../services/vehiculos.service';
import { ChoferesService, UsuarioChoferRol } from '../../../services/choferes.service';
import { ConsultarPlacaModalOpenerService } from '../../../services/consultar-placa-modal-opener.service';
import { EmpresaService } from '../../../services/empresa.service';

declare const iziToast: any;

@Component({
  selector: 'app-registrar-chofer-vehiculo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-chofer-vehiculo-modal.component.html',
  styleUrl: './registrar-chofer-vehiculo-modal.component.css'
})
export class RegistrarChoferVehiculoModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  /** Si true y no hay idEmpresaFiltro, lista choferes/vehículos de la gestora y todas las gestionadas. */
  @Input() esGestora = false;
  /** Si se indica, solo catálogos de esa empresa (p. ej. comprobante hijo abierto en despachos). */
  @Input() idEmpresaFiltro: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private choferesService = inject(ChoferesService);
  private vehiculosService = inject(VehiculosService);
  private consultarPlacaOpener = inject(ConsultarPlacaModalOpenerService);
  private empresaService = inject(EmpresaService);
  private placaCerradoSub?: Subscription;
  /** null hasta leer API; evita modal abierto antes de que el padre marque esGestora. */
  private esGestoraSegunApi: boolean | null = null;

  public usuariosChofer: UsuarioChoferRol[] = [];
  public usuarioChoferSeleccionado: string | null = null;
  /** Catálogo completo (consolidado gestora). */
  public vehiculosTodos: VehiculoRegistro[] = [];
  public vehiculos: VehiculoRegistro[] = [];
  public idVehiculoSeleccionado: string | null = null;
  public cargandoVehiculos = false;

  constructor() {
    this.placaCerradoSub = this.consultarPlacaOpener.cerrado$.subscribe(() => {
      if (this.visible) {
        this.cargarCatalogosModal();
      }
    });
  }

  ngOnDestroy(): void {
    this.placaCerradoSub?.unsubscribe();
  }

  public cargando = false;
  public cargandoUsuarios = false;

  ngOnChanges(changes: SimpleChanges): void {
    const abre = changes['visible']?.currentValue === true;
    const filtroCambio = changes['idEmpresaFiltro'] && !changes['idEmpresaFiltro'].firstChange;
    const gestoraCambio = changes['esGestora'] && !changes['esGestora'].firstChange;
    if (this.visible && (abre || filtroCambio || gestoraCambio)) {
      this.resetForm();
      this.cargarCatalogosModal();
    }
  }

  private resetForm(): void {
    this.usuarioChoferSeleccionado = null;
    this.idVehiculoSeleccionado = null;
    this.cargando = false;
    this.vehiculosTodos = [];
    this.vehiculos = [];
    this.esGestoraSegunApi = null;
  }

  /** Coalesce API reciente y @Input del padre. */
  esGestoraEfectiva(): boolean {
    return this.esGestoraSegunApi ?? this.esGestora;
  }

  /** Listado gestora + gestionadas (sin filtrar por un solo idEmpresa). */
  esListadoConsolidadoGestora(): boolean {
    return this.esGestoraEfectiva() && !this.idEmpresaFiltro?.trim();
  }

  onUsuarioChoferCambiado(): void {
    this.aplicarFiltroVehiculosPorUsuario();
  }

  private aplicarFiltroVehiculosPorUsuario(): void {
    const idEmpUsuario = this.idEmpresaUsuarioSeleccionado();
    if (this.esListadoConsolidadoGestora() && idEmpUsuario) {
      this.vehiculos = this.vehiculosTodos.filter((v) => v.idEmpresa === idEmpUsuario);
    } else {
      this.vehiculos = [...this.vehiculosTodos];
    }
    if (!this.idVehiculoSeleccionado || !this.vehiculos.some((v) => v.idVehiculo === this.idVehiculoSeleccionado)) {
      this.idVehiculoSeleccionado = this.vehiculos[0]?.idVehiculo ?? null;
    }
  }

  private idEmpresaUsuarioSeleccionado(): string | null {
    const u = this.usuariosChofer.find((x) => x.idUsuario === this.usuarioChoferSeleccionado);
    return u?.idEmpresa ?? this.idEmpresaFiltro?.trim() ?? null;
  }

  private cargarCatalogosModal(): void {
    const filtro = this.idEmpresaFiltro?.trim() || undefined;
    this.cargandoUsuarios = true;
    this.cargandoVehiculos = true;
    this.empresaService
      .getEstadoConfiguracion()
      .pipe(
        switchMap((cfg: { data?: { esGestora?: boolean } }) => {
          this.esGestoraSegunApi = !!cfg?.data?.esGestora;
          const consolidado = this.esGestoraEfectiva() && !filtro;
          const usuarios$ = consolidado
            ? this.choferesService.listarUsuariosChoferRol(undefined, { alcanceGestora: true })
            : this.choferesService.listarUsuariosChoferRol(filtro);
          const vehiculos$ = consolidado
            ? this.vehiculosService.listarVehiculos({ alcanceGestora: true })
            : this.vehiculosService.listarVehiculos(filtro ? { idEmpresa: filtro } : undefined);
          return forkJoin({ usuarios: usuarios$, vehiculos: vehiculos$ });
        })
      )
      .subscribe({
        next: ({ usuarios, vehiculos }) => {
          this.usuariosChofer = (usuarios?.data || []) as UsuarioChoferRol[];
          this.vehiculosTodos = (vehiculos?.data || []) as VehiculoRegistro[];
          if (this.usuariosChofer.length > 0) {
            this.usuarioChoferSeleccionado = this.usuariosChofer[0].idUsuario;
          } else {
            this.usuarioChoferSeleccionado = null;
          }
          this.aplicarFiltroVehiculosPorUsuario();
        },
        error: () => {
          this.usuariosChofer = [];
          this.vehiculosTodos = [];
          this.vehiculos = [];
        },
        complete: () => {
          this.cargandoUsuarios = false;
          this.cargandoVehiculos = false;
        }
      });
  }

  abrirConsultarPlaca(): void {
    this.consultarPlacaOpener.solicitarAbrir();
  }

  cerrar(): void {
    this.visible = false;
    this.closed.emit();
  }

  guardar(): void {
    const idUsuarioChofer = this.usuarioChoferSeleccionado;
    if (!idUsuarioChofer) {
      iziToast.warning({ title: 'Aviso', message: 'Seleccione un chofer.', position: 'topRight' });
      return;
    }
    if (!this.idVehiculoSeleccionado) {
      if (this.vehiculos.length === 0) {
        iziToast.warning({ title: 'Aviso', message: 'No hay vehículos registrados. Registre uno por placa.', position: 'topRight' });
        this.abrirConsultarPlaca();
        return;
      }
      iziToast.warning({ title: 'Aviso', message: 'Seleccione un vehículo.', position: 'topRight' });
      return;
    }

    const uSel = this.usuariosChofer.find((x) => x.idUsuario === idUsuarioChofer);
    const vSel = this.vehiculosTodos.find((x) => x.idVehiculo === this.idVehiculoSeleccionado) ||
      this.vehiculos.find((x) => x.idVehiculo === this.idVehiculoSeleccionado);
    const idEmpUsuario = uSel?.idEmpresa ?? this.idEmpresaFiltro?.trim() ?? null;
    if (vSel?.idEmpresa && idEmpUsuario && vSel.idEmpresa !== idEmpUsuario) {
      iziToast.warning({ title: 'Aviso', message: 'El vehículo debe ser de la misma empresa que el chofer.', position: 'topRight' });
      return;
    }

    this.cargando = true;
    const idVehiculo = this.idVehiculoSeleccionado;
    const idEmpresaBody =
      this.idEmpresaFiltro?.trim() ||
      (this.esGestoraEfectiva() && uSel?.idEmpresa ? uSel.idEmpresa : undefined);

    this.choferesService.guardarChoferInterno({
      idUsuarioChofer,
      idVehiculo,
      idEmpresa: idEmpresaBody
    }).subscribe({
      next: () => {
        iziToast.success({ title: 'OK', message: 'Chofer interno vinculado al vehículo.', position: 'topRight' });
        this.cargando = false;
        this.saved.emit();
        this.visible = false;
        this.closed.emit();
      },
      error: (err: any) => {
        this.cargando = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || err?.message || 'No se pudo guardar chofer.', position: 'topRight' });
      }
    });
  }
}

