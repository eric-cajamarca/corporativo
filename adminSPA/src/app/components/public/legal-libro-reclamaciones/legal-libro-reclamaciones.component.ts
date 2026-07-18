import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LibroReclamacionesService } from '../../../services/libro-reclamaciones.service';
import {
  LibroReclamacionRegistroResponse,
  ProveedorLibroReclamaciones
} from '../../../models/libro-reclamaciones.models';

@Component({
  selector: 'app-legal-libro-reclamaciones',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './legal-libro-reclamaciones.component.html',
  styleUrl: './legal-libro-reclamaciones.component.css'
})
export class LegalLibroReclamacionesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly libroService = inject(LibroReclamacionesService);

  proveedor = signal<ProveedorLibroReclamaciones | null>(null);
  enviando = signal(false);
  errorMsg = signal<string | null>(null);
  resultado = signal<LibroReclamacionRegistroResponse | null>(null);

  readonly form = this.fb.nonNullable.group({
    tipo: ['RECLAMO' as 'QUEJA' | 'RECLAMO', Validators.required],
    consumidorNombre: ['', [Validators.required, Validators.minLength(3)]],
    consumidorDocumentoTipo: ['DNI', Validators.required],
    consumidorDocumentoNumero: ['', [Validators.required, Validators.minLength(5)]],
    consumidorDomicilio: ['', [Validators.required, Validators.minLength(5)]],
    consumidorTelefono: [''],
    consumidorEmail: ['', [Validators.required, Validators.email]],
    esMenor: [false],
    tutorNombre: [''],
    bienTipo: ['SERVICIO' as 'PRODUCTO' | 'SERVICIO', Validators.required],
    bienDescripcion: ['', [Validators.required, Validators.minLength(3)]],
    bienMonto: [''],
    detalle: ['', [Validators.required, Validators.minLength(10)]],
    pedidoConsumidor: [''],
    aceptaVeracidad: [false, Validators.requiredTrue],
    website: ['']
  });

  ngOnInit(): void {
    this.libroService.obtenerProveedor().subscribe({
      next: (p) => this.proveedor.set(p),
      error: () =>
        this.proveedor.set({
          razonSocial: 'BUSINESS SOFT COMPANY S.A.C.',
          ruc: '20614636930',
          domicilio: 'PJ. LOS OLIVOS NRO. S/N URB. LOS OLIVOS, CAJAMARCA - JAÉN - JAÉN, Perú',
          telefono: '+51 993 289 440',
          email: 'businesssoftperu@gmail.com'
        })
    });

    this.form.controls.esMenor.valueChanges.subscribe((esMenor) => {
      const tutor = this.form.controls.tutorNombre;
      if (esMenor) {
        tutor.setValidators([Validators.required, Validators.minLength(3)]);
      } else {
        tutor.clearValidators();
        tutor.setValue('');
      }
      tutor.updateValueAndValidity({ emitEvent: false });
    });
  }

  hasError(controlName: string): boolean {
    const c = this.form.get(controlName);
    return !!c && c.invalid && (c.dirty || c.touched);
  }

  enviar(): void {
    this.errorMsg.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMsg.set('Complete los campos obligatorios marcados.');
      return;
    }

    const v = this.form.getRawValue();
    const bienMontoRaw = String(v.bienMonto || '').trim();
    let bienMonto: number | null = null;
    if (bienMontoRaw) {
      bienMonto = Number(bienMontoRaw);
      if (Number.isNaN(bienMonto) || bienMonto < 0) {
        this.errorMsg.set('El monto indicado no es válido.');
        return;
      }
    }

    this.enviando.set(true);
    this.libroService
      .registrar({
        tipo: v.tipo,
        consumidorNombre: v.consumidorNombre.trim(),
        consumidorDocumentoTipo: v.consumidorDocumentoTipo,
        consumidorDocumentoNumero: v.consumidorDocumentoNumero.trim(),
        consumidorDomicilio: v.consumidorDomicilio.trim(),
        consumidorTelefono: v.consumidorTelefono?.trim() || null,
        consumidorEmail: v.consumidorEmail.trim(),
        esMenor: !!v.esMenor,
        tutorNombre: v.esMenor ? v.tutorNombre.trim() : null,
        bienTipo: v.bienTipo,
        bienDescripcion: v.bienDescripcion.trim(),
        bienMonto,
        detalle: v.detalle.trim(),
        pedidoConsumidor: v.pedidoConsumidor?.trim() || null,
        website: v.website
      })
      .subscribe({
        next: (data) => {
          this.resultado.set(data);
          this.enviando.set(false);
          this.form.reset({
            tipo: 'RECLAMO',
            consumidorDocumentoTipo: 'DNI',
            bienTipo: 'SERVICIO',
            esMenor: false,
            aceptaVeracidad: false,
            website: ''
          });
        },
        error: (err) => {
          this.enviando.set(false);
          this.errorMsg.set(err?.error?.message || 'No se pudo registrar. Intente nuevamente.');
        }
      });
  }

  nuevaHoja(): void {
    this.resultado.set(null);
    this.errorMsg.set(null);
  }
}
