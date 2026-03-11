import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactilizaService } from '../../../services/factiliza.service';

declare const iziToast: any;

@Component({
  selector: 'app-consultar-soat-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="modal-backdrop fade show" *ngIf="visible"></div>
  <div class="modal fade show d-block" tabindex="-1" *ngIf="visible">
    <div class="modal-dialog modal-md modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-file-medical me-2"></i> Consultar SOAT (Factiliza)
          </h5>
          <button type="button" class="btn-close" aria-label="Close" (click)="cerrar()"></button>
        </div>
        <div class="modal-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-md-6">
              <label class="form-label">Placa</label>
              <input type="text"
                     class="form-control form-control-sm"
                     [(ngModel)]="placa"
                     placeholder="ABC123"
                     (keyup.enter)="consultar()">
            </div>
            <div class="col-md-4">
              <button class="btn btn-sm btn-primary w-100"
                      (click)="consultar()"
                      [disabled]="consultando">
                <span *ngIf="consultando" class="spinner-border spinner-border-sm me-1"></span>
                Consultar SOAT
              </button>
            </div>
          </div>

          <ng-container *ngIf="soat">
            <ul class="list-unstyled small mb-0">
              <li><strong>Placa:</strong> {{ soat.placa }}</li>
              <li><strong>Compañía:</strong> {{ soat.nombre_compania }}</li>
              <li><strong>Estado:</strong> {{ soat.estado }}</li>
              <li><strong>Desde:</strong> {{ soat.fecha_inicio }}</li>
              <li><strong>Hasta:</strong> {{ soat.fecha_fin }}</li>
              <li><strong>N° póliza:</strong> {{ soat.numero_poliza }}</li>
            </ul>
          </ng-container>

          <p *ngIf="!soat && !consultando" class="text-muted small mb-0">
            Ingrese una placa y presione <strong>Consultar SOAT</strong>. La información proviene de Factiliza y no se guarda en la base de datos.
          </p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary btn-sm" (click)="cerrar()">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styleUrls: []
})
export class ConsultarSoatModalComponent {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  placa = '';
  consultando = false;
  soat: any = null;

  private factiliza = inject(FactilizaService);

  cerrar(): void {
    this.visible = false;
    this.closed.emit();
    this.placa = '';
    this.soat = null;
    this.consultando = false;
  }

  consultar(): void {
    const placaTrim = (this.placa || '').toString().trim().toUpperCase();
    if (!placaTrim) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese una placa.', position: 'topRight' });
      return;
    }
    this.consultando = true;
    this.soat = null;

    this.factiliza.getSoat(placaTrim).subscribe({
      next: (res: any) => {
        this.soat = res?.data || null;
      },
      error: () => {
        this.soat = null;
      },
      complete: () => {
        this.consultando = false;
      }
    });
  }
}

