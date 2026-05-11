import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EnviosService } from '../../../services/envios.service';

declare const iziToast: any;

@Component({
  selector: 'app-registrar-transportista-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrar-transportista-modal.component.html',
  styleUrl: './registrar-transportista-modal.component.css'
})
export class RegistrarTransportistaModalComponent implements OnChanges {
  @Input() visible = false;
  /** Empresa gestora: crear transportista en la empresa del comprobante hijo. */
  @Input() idEmpresaDestino: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private enviosService = inject(EnviosService);

  public cargando = false;
  public nombres = '';
  public apellidos = '';
  public documento = '';
  public licencia = '';
  public celular = '';
  public email = '';
  public vehiculo = '';
  public placa = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.resetForm();
    }
  }

  private resetForm(): void {
    this.cargando = false;
    this.nombres = '';
    this.apellidos = '';
    this.documento = '';
    this.licencia = '';
    this.celular = '';
    this.email = '';
    this.vehiculo = '';
    this.placa = '';
  }

  cerrar(): void {
    this.visible = false;
    this.closed.emit();
  }

  guardar(): void {
    const nombres = this.nombres.trim();
    const apellidos = this.apellidos.trim();
    const documento = this.documento.trim().toUpperCase();
    const celular = this.celular.trim();
    const vehiculo = this.vehiculo.trim();
    const placa = this.placa.trim().toUpperCase();

    if (!nombres || !apellidos || !documento || !celular) {
      iziToast.warning({ title: 'Aviso', message: 'Complete los campos requeridos.', position: 'topRight' });
      return;
    }
    if (!placa || !vehiculo) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese vehículo y placa.', position: 'topRight' });
      return;
    }

    const payload: Record<string, unknown> = {
      nombres,
      apellidos,
      documento,
      licencia: this.licencia.trim() || null,
      celular,
      email: this.email.trim() || null,
      vehiculo: vehiculo || null,
      placa: placa || null
    };

    this.cargando = true;

    const idEmp = (this.idEmpresaDestino || '').trim();
    if (idEmp) {
      payload['idEmpresa'] = idEmp;
    }

    this.enviosService.crearTransportista(payload as any).subscribe({
      next: () => {
        iziToast.success({ title: 'OK', message: 'Delivery externo registrado.', position: 'topRight' });
        this.cargando = false;
        this.saved.emit();
        this.visible = false;
        this.closed.emit();
      },
      error: (err: any) => {
        this.cargando = false;
        iziToast.error({ title: 'Error', message: err?.error?.message || err?.message || 'No se pudo guardar.', position: 'topRight' });
      }
    });
  }
}

