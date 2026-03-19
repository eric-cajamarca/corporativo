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
    const payload = {
      nombres: this.nombres.trim(),
      apellidos: this.apellidos.trim(),
      documento: this.documento.trim().toUpperCase(),
      licencia: this.licencia.trim() || null,
      celular: this.celular.trim(),
      email: this.email.trim() || null,
      vehiculo: this.vehiculo.trim() || null,
      placa: this.placa.trim().toUpperCase() || null
    };

    if (!payload.nombres || !payload.apellidos || !payload.documento || !payload.celular) {
      iziToast.warning({ title: 'Aviso', message: 'Complete los campos requeridos.', position: 'topRight' });
      return;
    }
    if (!payload.placa || !payload.vehiculo) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese vehículo y placa.', position: 'topRight' });
      return;
    }

    this.cargando = true;

    this.enviosService.crearTransportista(payload).subscribe({
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

