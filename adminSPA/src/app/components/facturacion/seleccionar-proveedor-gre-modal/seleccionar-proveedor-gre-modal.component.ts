import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProveedoresService } from '../../../services/proveedores.service';

declare const iziToast: any;

export interface ProveedorGreListado {
  idProveedor: number | string;
  ruc: string;
  rSocial: string;
  condicion?: string;
}

@Component({
  selector: 'app-seleccionar-proveedor-gre-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop fade show" *ngIf="visible"></div>
    <div class="modal fade show d-block" tabindex="-1" *ngIf="visible" role="dialog" aria-modal="true">
      <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-truck me-2"></i> Elegir proveedor (compra / guía)
            </h5>
            <button type="button" class="btn-close" aria-label="Cerrar" (click)="cerrar()"></button>
          </div>
          <div class="modal-body">
            <div class="row g-2 mb-3 align-items-end">
              <div class="col-md-8">
                <label class="form-label">Buscar por razón social o RUC</label>
                <input
                  type="text"
                  class="form-control form-control-sm"
                  [(ngModel)]="filtroTexto"
                  placeholder="Escriba para filtrar…"
                  (ngModelChange)="aplicarFiltro()" />
              </div>
              <div class="col-md-4">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary w-100"
                  (click)="cargarProveedores()"
                  [disabled]="cargando">
                  <span *ngIf="cargando" class="spinner-border spinner-border-sm me-1"></span>
                  Actualizar lista
                </button>
              </div>
            </div>

            <div *ngIf="errorCarga" class="alert alert-warning small py-2">{{ errorCarga }}</div>

            <div class="table-responsive border rounded" style="max-height: 360px; overflow-y: auto">
              <table class="table table-sm table-hover mb-0">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>RUC</th>
                    <th>Razón social</th>
                    <th class="text-end" style="width: 7rem">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let p of proveedoresFiltrados">
                    <td class="text-nowrap">{{ p.ruc }}</td>
                    <td>{{ p.rSocial }}</td>
                    <td class="text-end">
                      <button type="button" class="btn btn-sm btn-primary" (click)="elegir(p)">Elegir</button>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p *ngIf="!cargando && proveedoresFiltrados.length === 0" class="text-muted small p-3 mb-0">
                No hay proveedores que coincidan o la lista está vacía. Registre proveedores en <strong>Compras → Proveedores</strong>.
              </p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="cerrar()">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal {
        background: rgba(0, 0, 0, 0.35);
      }
    `
  ]
})
export class SeleccionarProveedorGreModalComponent {
  private proveedoresService = inject(ProveedoresService);

  private _visible = false;

  @Input()
  set visible(v: boolean) {
    const abre = v === true && !this._visible;
    this._visible = !!v;
    if (abre) {
      this.filtroTexto = '';
      this.errorCarga = '';
      this.cargarProveedores();
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  @Output() closed = new EventEmitter<void>();
  @Output() proveedorElegido = new EventEmitter<ProveedorGreListado>();

  filtroTexto = '';
  cargando = false;
  errorCarga = '';
  proveedoresTodos: ProveedorGreListado[] = [];
  proveedoresFiltrados: ProveedorGreListado[] = [];

  cerrar(): void {
    this._visible = false;
    this.closed.emit();
  }

  cargarProveedores(): void {
    this.cargando = true;
    this.errorCarga = '';
    this.proveedoresService.obtener_proveedores().subscribe({
      next: (res: { data?: ProveedorGreListado[] }) => {
        this.cargando = false;
        const raw = Array.isArray(res?.data) ? res.data : [];
        this.proveedoresTodos = raw.map((row) => ({
          idProveedor: row.idProveedor,
          ruc: String(row.ruc || '').trim(),
          rSocial: String(row.rSocial || '').trim(),
          condicion: row.condicion
        }));
        this.aplicarFiltro();
      },
      error: (err: { error?: { message?: string }; status?: number }) => {
        this.cargando = false;
        this.proveedoresTodos = [];
        this.proveedoresFiltrados = [];
        const msg =
          err?.error?.message ||
          (err?.status === 403
            ? 'No tiene permiso para listar proveedores (se requiere rol con acceso a proveedores).'
            : 'No se pudo cargar la lista de proveedores.');
        this.errorCarga = msg;
        iziToast.error({ title: 'Proveedores', message: msg, position: 'topRight' });
      }
    });
  }

  aplicarFiltro(): void {
    const q = (this.filtroTexto || '').toLowerCase().trim();
    if (!q) {
      this.proveedoresFiltrados = [...this.proveedoresTodos];
      return;
    }
    this.proveedoresFiltrados = this.proveedoresTodos.filter(
      (p) =>
        p.rSocial.toLowerCase().includes(q) ||
        p.ruc.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }

  elegir(p: ProveedorGreListado): void {
    this.proveedorElegido.emit(p);
    this.cerrar();
  }
}
