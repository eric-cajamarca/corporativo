import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CajaService } from '../../../services/caja.service';

declare var iziToast: any;

export interface TipoMovimientoCajaItem {
  idTipoMovimientoCaja: number;
  nombre: string;
  descripcion?: string;
  tipo: 'I' | 'E';
}

@Component({
  selector: 'app-index-clasificacion-conceptos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-clasificacion-conceptos.component.html',
  styleUrl: './index-clasificacion-conceptos.component.css'
})
export class IndexClasificacionConceptosComponent implements OnInit {
  items: TipoMovimientoCajaItem[] = [];
  itemsCompletos: TipoMovimientoCajaItem[] = [];
  total = 0;
  buscar = '';
  page = 1;
  pageSize = 10;
  maxSize = 5;
  loading = false;
  itemEditar: Partial<TipoMovimientoCajaItem> & { nombre?: string; descripcion?: string; tipo?: 'I' | 'E' } = {};
  itemVer: TipoMovimientoCajaItem | null = null;
  loadSave = false;

  constructor(
    private cajaService: CajaService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (res) => {
        const list = (res.data || []) as TipoMovimientoCajaItem[];
        if (this.buscar.trim()) {
          const b = this.buscar.trim().toLowerCase();
          this.itemsCompletos = list.filter(
            (x) =>
              (x.nombre || '').toLowerCase().includes(b) ||
              (x.descripcion || '').toLowerCase().includes(b) ||
              (x.tipo === 'I' ? 'ingreso' : 'egreso').includes(b)
          );
        } else {
          this.itemsCompletos = list;
        }
        this.total = this.itemsCompletos.length;
        const start = (this.page - 1) * this.pageSize;
        this.items = this.itemsCompletos.slice(start, start + this.pageSize);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        iziToast.error({ title: 'Error', message: 'No se pudo cargar el listado.' });
      }
    });
  }

  filtrar(): void {
    this.page = 1;
    this.cargar();
  }

  onPageChange(p: number): void {
    this.page = p;
    const start = (this.page - 1) * this.pageSize;
    this.items = this.itemsCompletos.slice(start, start + this.pageSize);
  }

  abrirCrear(): void {
    this.itemEditar = { nombre: '', descripcion: '', tipo: 'E' };
    this.loadSave = false;
    const modal = document.getElementById('modalFormClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: TipoMovimientoCajaItem): void {
    this.itemEditar = {
      idTipoMovimientoCaja: item.idTipoMovimientoCaja,
      nombre: item.nombre,
      descripcion: item.descripcion || '',
      tipo: item.tipo
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: TipoMovimientoCajaItem): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const nombre = (this.itemEditar.nombre || '').trim();
    if (!nombre) {
      iziToast.warning({ title: 'Validación', message: 'El nombre es obligatorio.' });
      return;
    }
    const tipo = this.itemEditar.tipo === 'I' || this.itemEditar.tipo === 'E' ? this.itemEditar.tipo : 'E';
    const descripcion = (this.itemEditar.descripcion || '').trim() || undefined;
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idTipoMovimientoCaja;
    const req = esNuevo
      ? this.cajaService.crearTipoMovimientoCaja({ nombre, descripcion, tipo })
      : this.cajaService.actualizarTipoMovimientoCaja(this.itemEditar.idTipoMovimientoCaja!, { nombre, descripcion, tipo });
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormClasif');
        if (m && (window as any).bootstrap) (window as any).bootstrap.Modal.getInstance(m)?.hide();
        iziToast.success({ title: 'Éxito', message: esNuevo ? 'Registro creado.' : 'Registro actualizado.' });
        this.cargar();
      },
      error: (err) => {
        this.loadSave = false;
        iziToast.error({ title: 'Error', message: err.error?.message || 'Error al guardar.' });
      }
    });
  }

  confirmarEliminar(item: TipoMovimientoCajaItem): void {
    if (!confirm('¿Eliminar este tipo de movimiento?')) return;
    this.cajaService.eliminarTipoMovimientoCaja(item.idTipoMovimientoCaja).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Registro eliminado.' });
        this.cargar();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err.error?.message || 'Error al eliminar.' });
      }
    });
  }

  etiquetaTipo(tipo: string): string {
    return tipo === 'I' ? 'Ingreso' : 'Egreso';
  }
}
