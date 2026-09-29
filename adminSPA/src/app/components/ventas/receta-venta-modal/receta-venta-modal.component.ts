import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { LineaRecetaVenta, RecetaVentaPayload } from '../../../models/receta-venta.model';
import { etiquetaCondicionVenta, normalizarCondicionVenta } from '../../../utils/receta-venta.util';
import { FactilizaService } from '../../../services/factiliza.service';

declare var iziToast: any;

function nombreDesdeConsultaDni(raw: unknown): string {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const data =
    r['data'] && typeof r['data'] === 'object'
      ? (r['data'] as Record<string, unknown>)
      : r;
  const ap = String(data['apellidoPaterno'] ?? data['apellido_paterno'] ?? '').trim();
  const am = String(data['apellidoMaterno'] ?? data['apellido_materno'] ?? '').trim();
  const nom = String(data['nombres'] ?? '').trim();
  const partes = [ap, am, nom].filter(Boolean);
  if (partes.length) return partes.join(' ').replace(/\s+/g, ' ');
  return String(
    data['nombre_completo'] ?? data['nombreCompleto'] ?? data['nombre'] ?? data['nombre_o_razon_social'] ?? ''
  ).trim();
}

@Component({
  selector: 'app-receta-venta-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="modal-header">
      <h5 class="modal-title"><i class="bi bi-clipboard2-pulse me-2"></i>Receta médica</h5>
      <button type="button" class="btn-close" aria-label="Cerrar" (click)="activeModal.dismiss()"></button>
    </div>
    <div class="modal-body">
      <p class="small text-muted mb-2">Hay medicamentos que requieren receta. Complete los datos para cobrar.</p>
      <ul class="list-group list-group-flush mb-3">
        @for (l of lineas; track l.idProducto) {
          <li class="list-group-item px-0 d-flex justify-content-between gap-2">
            <span>{{ l.descripcion }} <small class="text-muted">× {{ l.cantidad }}</small></span>
            <span class="badge text-bg-warning">{{ etiquetaCondicion(l.condicionVenta) }}</span>
          </li>
        }
      </ul>
      <form [formGroup]="form">
        <div class="row g-2">
          <div class="col-md-4">
            <label class="form-label">DNI paciente</label>
            <div class="input-group">
              <input
                class="form-control"
                formControlName="pacienteDoc"
                maxlength="8"
                inputmode="numeric"
                placeholder="8 dígitos"
                (keydown.enter)="buscarDni($event)"
              />
              <button
                type="button"
                class="btn btn-outline-primary"
                (click)="buscarDni()"
                [disabled]="buscandoDni || !dniPacienteValido"
                title="Consultar DNI"
              >
                @if (buscandoDni) {
                  <span class="spinner-border spinner-border-sm"></span>
                } @else {
                  <i class="bi bi-search"></i>
                }
              </button>
            </div>
          </div>
          <div class="col-md-8">
            <label class="form-label">Paciente *</label>
            <input class="form-control" formControlName="pacienteNombre" maxlength="150" />
          </div>
          <div class="col-md-8">
            <label class="form-label">Médico *</label>
            <input class="form-control" formControlName="medicoNombre" maxlength="150" />
          </div>
          <div class="col-md-4">
            <label class="form-label">CMP *</label>
            <input
              class="form-control"
              formControlName="cmp"
              maxlength="8"
              inputmode="numeric"
              placeholder="N° colegiatura"
            />
            @if (form.get('cmp')?.touched && form.get('cmp')?.invalid) {
              <div class="small text-danger">Ingrese un CMP numérico (4 a 8 dígitos).</div>
            }
          </div>
          <div class="col-md-6">
            <label class="form-label">N° receta *</label>
            <input class="form-control" formControlName="numeroReceta" maxlength="40" />
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha receta *</label>
            <input type="date" class="form-control" formControlName="fechaReceta" />
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-outline-secondary" (click)="activeModal.dismiss()">Cancelar</button>
      <button type="button" class="btn btn-success" (click)="confirmar()" [disabled]="form.invalid">
        Guardar y cobrar
      </button>
    </div>
  `
})
export class RecetaVentaModalComponent implements OnInit {
  @Input() lineas: LineaRecetaVenta[] = [];

  form!: FormGroup;
  buscandoDni = false;

  constructor(
    public activeModal: NgbActiveModal,
    private fb: FormBuilder,
    private factiliza: FactilizaService
  ) {}

  ngOnInit(): void {
    const hoy = new Date();
    const ymd = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    this.form = this.fb.group({
      pacienteNombre: ['', [Validators.required, Validators.minLength(3)]],
      pacienteDoc: ['', [Validators.pattern(/^\d{0,8}$/)]],
      medicoNombre: ['', [Validators.required, Validators.minLength(3)]],
      cmp: ['', [Validators.required, Validators.pattern(/^\d{4,8}$/)]],
      numeroReceta: ['', Validators.required],
      fechaReceta: [ymd, Validators.required]
    });
  }

  get dniPacienteValido(): boolean {
    return /^\d{8}$/.test(String(this.form?.get('pacienteDoc')?.value || '').trim());
  }

  etiquetaCondicion(valor?: string | null): string {
    return etiquetaCondicionVenta(valor);
  }

  buscarDni(event?: Event): void {
    event?.preventDefault?.();
    const dni = String(this.form.get('pacienteDoc')?.value || '').trim();
    if (!/^\d{8}$/.test(dni)) {
      iziToast.warning({
        title: 'DNI',
        message: 'Ingrese un DNI de 8 dígitos para consultar.',
        position: 'topRight'
      });
      return;
    }
    this.buscandoDni = true;
    this.factiliza.getDni(dni).subscribe({
      next: (res: unknown) => {
        const nombre = nombreDesdeConsultaDni(res);
        this.buscandoDni = false;
        if (!nombre) {
          iziToast.warning({
            title: 'DNI',
            message: 'No se obtuvo el nombre. Complételo a mano.',
            position: 'topRight'
          });
          return;
        }
        this.form.patchValue({ pacienteNombre: nombre });
        iziToast.success({ title: 'OK', message: 'Paciente encontrado.', position: 'topRight' });
      },
      error: (err: { error?: { message?: string } }) => {
        this.buscandoDni = false;
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || 'No se pudo consultar el DNI.',
          position: 'topRight'
        });
      }
    });
  }

  confirmar(): void {
    if (this.form.invalid) {
      Object.keys(this.form.controls).forEach((k) => this.form.get(k)?.markAsTouched());
      return;
    }
    const v = this.form.value;
    const tipo = normalizarCondicionVenta(this.lineas[0]?.condicionVenta);
    const payload: RecetaVentaPayload = {
      tipo: tipo === 'LIBRE' ? 'RECETA' : tipo,
      pacienteNombre: String(v.pacienteNombre || '').trim(),
      pacienteDoc: String(v.pacienteDoc || '').trim() || undefined,
      medicoNombre: String(v.medicoNombre || '').trim(),
      cmp: String(v.cmp || '').trim(),
      numeroReceta: String(v.numeroReceta || '').trim(),
      fechaReceta: String(v.fechaReceta || '').trim().slice(0, 10)
    };
    this.activeModal.close(payload);
  }
}
