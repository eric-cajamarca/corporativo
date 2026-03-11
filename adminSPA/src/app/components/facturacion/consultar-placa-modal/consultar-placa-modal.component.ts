import { Component, EventEmitter, Input, Output, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FactilizaService } from '../../../services/factiliza.service';
import { VehiculosService, VehiculoRegistro } from '../../../services/vehiculos.service';

declare const iziToast: any;

@Component({
  selector: 'app-consultar-placa-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="modal-backdrop fade show" *ngIf="visible"></div>
  <div class="modal fade show d-block" tabindex="-1" *ngIf="visible">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-car-front me-2"></i> Consultar placa (Factiliza)
          </h5>
          <button type="button" class="btn-close" aria-label="Close" (click)="cerrar()"></button>
        </div>
        <div class="modal-body">
          <div class="row g-2 align-items-end mb-3">
            <div class="col-md-4">
              <label class="form-label">Placa</label>
              <input type="text"
                     class="form-control form-control-sm"
                     [(ngModel)]="placa"
                     placeholder="ABC123"
                     (keyup.enter)="consultar()">
            </div>
            <div class="col-md-3">
              <button class="btn btn-sm btn-primary w-100"
                      (click)="consultar()"
                      [disabled]="consultando">
                <span *ngIf="consultando" class="spinner-border spinner-border-sm me-1"></span>
                Consultar
              </button>
            </div>
          </div>

          <ng-container *ngIf="vehiculo || soat">
            <div class="row mb-3">
              <div class="col-md-6" *ngIf="vehiculo">
                <h6>Datos del vehículo</h6>
                <ul class="list-unstyled small mb-0">
                  <li><strong>Placa:</strong> {{ vehiculo.placa }}</li>
                  <li><strong>Marca:</strong> {{ vehiculo.marca }}</li>
                  <li><strong>Modelo:</strong> {{ vehiculo.modelo }}</li>
                  <li><strong>Color:</strong> {{ vehiculo.color }}</li>
                  <li><strong>Serie/VIN:</strong> {{ vehiculo.serie || vehiculo.vin }}</li>
                  <li><strong>Motor:</strong> {{ vehiculo.motor }}</li>
                </ul>
              </div>
              <div class="col-md-6" *ngIf="soat">
                <h6>SOAT</h6>
                <ul class="list-unstyled small mb-0">
                  <li><strong>Compañía:</strong> {{ soat.nombre_compania }}</li>
                  <li><strong>Estado:</strong> <span [class.text-danger]="soat.estado === 'VENCIDO'">{{ soat.estado }}</span></li>
                  <li><strong>Desde:</strong> {{ soat.fecha_inicio }}</li>
                  <li><strong>Hasta:</strong> {{ soat.fecha_fin }}</li>
                  <li><strong>N° póliza:</strong> {{ soat.numero_poliza }}</li>
                </ul>
              </div>
            </div>
            <div class="mb-3">
              <button class="btn btn-sm btn-success"
                      (click)="guardarVehiculoYSoat()"
                      [disabled]="guardando">
                <span *ngIf="guardando" class="spinner-border spinner-border-sm me-1"></span>
                Guardar vehiculo y SOAT
              </button>
            </div>
          </ng-container>

          <p *ngIf="!vehiculo && !soat && !consultando" class="text-muted small mb-0">
            Ingrese una placa y presione <strong>Consultar</strong> para obtener datos del vehículo y su SOAT desde Factiliza.
          </p>

          <hr class="my-3">

          <h6 class="text-danger mb-2" *ngIf="vehiculosSoatVencido.length > 0">
            <i class="bi bi-exclamation-triangle me-1"></i> Vehículos con SOAT vencido ({{ vehiculosSoatVencido.length }})
          </h6>
          <div class="table-responsive mb-3" *ngIf="vehiculosSoatVencido.length > 0">
            <table class="table table-sm table-bordered">
              <thead><tr><th>Placa</th><th>Marca</th><th>Modelo</th><th>Estado SOAT</th><th>Vence</th><th>Compañía</th></tr></thead>
              <tbody>
                <tr *ngFor="let v of vehiculosSoatVencido">
                  <td>{{ v.placa }}</td>
                  <td>{{ v.marca }}</td>
                  <td>{{ v.modelo }}</td>
                  <td><span class="badge bg-danger">{{ v.soatEstado || 'Sin SOAT' }}</span></td>
                  <td>{{ v.soatFechaFin }}</td>
                  <td>{{ v.soatCompania }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="vehiculosSoatVencido.length === 0 && !cargandoListas" class="text-muted small mb-0">
            No hay vehículos registrados con SOAT vencido.
          </p>

          <h6 class="mb-2">Vehículos registrados y estado SOAT</h6>
          <div class="table-responsive">
            <table class="table table-sm table-bordered">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Marca</th>
                  <th>Modelo</th>
                  <th>Estado SOAT</th>
                  <th>Vence</th>
                  <th>Compañía</th>
                  <th style="width: 130px;">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let v of vehiculosRegistrados">
                  <td>{{ v.placa }}</td>
                  <td>{{ v.marca }}</td>
                  <td>{{ v.modelo }}</td>
                  <td>
                    <span class="badge" [class.bg-danger]="v.soatEstado === 'VENCIDO'" [class.bg-success]="v.soatEstado !== 'VENCIDO' && v.soatEstado">
                      {{ v.soatEstado || 'Sin dato' }}
                    </span>
                  </td>
                  <td>{{ v.soatFechaFin }}</td>
                  <td>{{ v.soatCompania }}</td>
                  <td>
                    <i class="bi bi-pencil text-primary" (click)="editarVehiculo(v) "></i>
                    <i class="bi bi-trash text-danger" (click)="eliminarVehiculo(v)"></i>
                    
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p *ngIf="vehiculosRegistrados.length === 0 && !cargandoListas" class="text-muted small mb-0">
            Aún no hay vehículos registrados. Consulte una placa y use «Guardar vehiculo y SOAT».
          </p>
          <p *ngIf="cargandoListas" class="text-muted small mb-0"><span class="spinner-border spinner-border-sm me-1"></span> Cargando listas...</p>
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
export class ConsultarPlacaModalComponent implements OnChanges {
  @Input() visible = false;
  @Output() closed = new EventEmitter<void>();

  placa = '';
  consultando = false;
  guardando = false;
  vehiculo: any = null;
  soat: any = null;
  vehiculosRegistrados: VehiculoRegistro[] = [];
  vehiculosSoatVencido: VehiculoRegistro[] = [];
  cargandoListas = false;

  private factiliza = inject(FactilizaService);
  private vehiculosService = inject(VehiculosService);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.cargarListas();
    }
  }

  cerrar(): void {
    this.visible = false;
    this.closed.emit();
    this.placa = '';
    this.vehiculo = null;
    this.soat = null;
    this.consultando = false;
    this.guardando = false;
  }

  cargarListas(): void {
    this.cargandoListas = true;
    this.vehiculosService.listarVehiculos().subscribe({
      next: (res) => {
        this.vehiculosRegistrados = res?.data || [];
      },
      error: () => { this.vehiculosRegistrados = []; },
      complete: () => { this.cargandoListas = false; }
    });
    this.vehiculosService.listarVehiculosSoatVencido().subscribe({
      next: (res) => {
        this.vehiculosSoatVencido = res?.data || [];
      },
      error: () => { this.vehiculosSoatVencido = []; }
    });
  }

  consultar(): void {
    const placaTrim = (this.placa || '').toString().trim().toUpperCase();
    if (!placaTrim) {
      iziToast.warning({ title: 'Aviso', message: 'Ingrese una placa.', position: 'topRight' });
      return;
    }
    this.consultando = true;
    this.vehiculo = null;
    this.soat = null;

    this.factiliza.getPlaca(placaTrim).subscribe({
      next: (res: any) => {
        this.vehiculo = res?.data || null;
      },
      error: () => {
        this.vehiculo = null;
      }
    });

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

  guardarVehiculoYSoat(): void {
    const v = this.vehiculo;
    const s = this.soat;
    const placaTrim = (this.placa || '').toString().trim().toUpperCase();
    if (!placaTrim) {
      iziToast.warning({ title: 'Aviso', message: 'Consulte primero una placa.', position: 'topRight' });
      return;
    }
    const vehiculo = v ? { placa: placaTrim, marca: v.marca, modelo: v.modelo, color: v.color, serie: v.serie, motor: v.motor, vin: v.vin } : { placa: placaTrim };
    const soat = s ? { placa: placaTrim, nombre_compania: s.nombre_compania, fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin, estado: s.estado, numero_poliza: s.numero_poliza, codigo_sbs_aseguradora: s.codigo_sbs_aseguradora, codigo_unico_poliza: s.codigo_unico_poliza } : null;
    this.guardando = true;
    this.vehiculosService.guardarVehiculoYSoat(vehiculo, soat).subscribe({
      next: () => {
        iziToast.success({ title: 'Guardado', message: 'Vehículo y SOAT registrados.', position: 'topRight' });
        this.cargarListas();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo guardar.', position: 'topRight' });
      },
      complete: () => { this.guardando = false; }
    });
  }

  editarVehiculo(v: VehiculoRegistro): void {
    this.placa = v.placa;
    this.vehiculo = {
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      color: v.color,
      serie: v.serie,
      motor: v.motor,
      vin: v.vin
    };
    this.consultar();
  }

  eliminarVehiculo(v: VehiculoRegistro): void {
    if (!v.idVehiculo) {
      iziToast.error({ title: 'Error', message: 'No se encontró el identificador del vehículo.', position: 'topRight' });
      return;
    }
    if (!confirm(`¿Eliminar el vehículo ${v.placa}?`)) {
      return;
    }
    this.vehiculosService.eliminarVehiculo(v.idVehiculo).subscribe({
      next: () => {
        iziToast.success({ title: 'Eliminado', message: 'Vehículo eliminado correctamente.', position: 'topRight' });
        this.cargarListas();
        if (this.placa === v.placa) {
          this.placa = '';
          this.vehiculo = null;
          this.soat = null;
        }
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err?.error?.message || 'No se pudo eliminar el vehículo.', position: 'topRight' });
      }
    });
  }
}

