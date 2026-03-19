import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehiculosService, VehiculoRegistro } from '../../../services/vehiculos.service';
import { ChoferesService, UsuarioChoferRol } from '../../../services/choferes.service';
import { ConsultarPlacaModalComponent } from '../../facturacion/consultar-placa-modal/consultar-placa-modal.component';

declare const iziToast: any;

@Component({
  selector: 'app-registrar-chofer-vehiculo-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ConsultarPlacaModalComponent],
  templateUrl: './registrar-chofer-vehiculo-modal.component.html',
  styleUrl: './registrar-chofer-vehiculo-modal.component.css'
})
export class RegistrarChoferVehiculoModalComponent implements OnChanges {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private choferesService = inject(ChoferesService);
  private vehiculosService = inject(VehiculosService);

  public usuariosChofer: UsuarioChoferRol[] = [];
  public usuarioChoferSeleccionado: string | null = null;
  public vehiculos: VehiculoRegistro[] = [];
  public idVehiculoSeleccionado: string | null = null;
  public cargandoVehiculos = false;
  public modalConsultarPlacaVisible = false;

  public cargando = false;
  public cargandoUsuarios = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.cargarUsuariosChofer();
      this.cargarVehiculosEmpresa();
      this.resetForm();
    }
  }

  private resetForm(): void {
    this.usuarioChoferSeleccionado = null;
    this.idVehiculoSeleccionado = null;
    this.cargando = false;
  }

  private cargarUsuariosChofer(): void {
    this.cargandoUsuarios = true;
    this.choferesService.listarUsuariosChoferRol().subscribe({
      next: (res: any) => {
        this.usuariosChofer = (res?.data || []) as UsuarioChoferRol[];
        if (this.usuariosChofer.length > 0) {
          this.usuarioChoferSeleccionado = this.usuariosChofer[0].idUsuario;
        }
      },
      error: () => {
        this.usuariosChofer = [];
      },
      complete: () => {
        this.cargandoUsuarios = false;
      }
    });
  }

  private cargarVehiculosEmpresa(): void {
    this.cargandoVehiculos = true;
    this.vehiculosService.listarVehiculos().subscribe({
      next: (res: any) => {
        this.vehiculos = (res?.data || []) as VehiculoRegistro[];
        if (!this.idVehiculoSeleccionado && this.vehiculos.length > 0) {
          this.idVehiculoSeleccionado = this.vehiculos[0].idVehiculo;
        }
      },
      error: () => {
        this.vehiculos = [];
      },
      complete: () => {
        this.cargandoVehiculos = false;
      }
    });
  }

  abrirConsultarPlaca(): void {
    this.modalConsultarPlacaVisible = true;
  }

  onConsultarPlacaCerrado(): void {
    this.modalConsultarPlacaVisible = false;
    // Al cerrar, refrescar lista de vehículos por si se registró uno nuevo.
    this.cargarVehiculosEmpresa();
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

    this.cargando = true;
    const idVehiculo = this.idVehiculoSeleccionado;

    this.choferesService.guardarChoferInterno({
      idUsuarioChofer,
      idVehiculo
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

