import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { CatalogosService } from '../../../services/catalogos.service';

declare var iziToast: any;

export interface TipoMovimientoCajaItem {
  idTipoMovimientoCaja: number;
  nombre: string;
  descripcion?: string;
  tipo: string;
}

@Component({
  selector: 'app-index-tipo-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './index-tipo-movimientos.component.html',
  styleUrl: './index-tipo-movimientos.component.css'
})
export class IndexTipoMovimientosComponent implements OnInit {
  items: TipoMovimientoCajaItem[] = [];
  buscar = '';
  loading = false;
  itemEditar: Partial<TipoMovimientoCajaItem> & { nombre?: string; descripcion?: string; tipo?: 'I' | 'E' } = {};
  itemVer: TipoMovimientoCajaItem | null = null;
  loadSave = false;
  tipos: { value: 'I' | 'E'; label: string }[] = [
    { value: 'I', label: 'Ingreso' },
    { value: 'E', label: 'Egreso' }
  ];

  constructor(
    private catalogosService: CatalogosService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarTipoMovimientos(this.buscar || undefined).subscribe({
      next: (res) => {
        this.items = (res.data || []) as TipoMovimientoCajaItem[];
                this.loading = false;
      },
      error: () => {
        this.loading = false;
        iziToast.error({ title: 'Error', message: 'No se pudo cargar el listado.' });
      }
    });
  }

  filtrar(): void {
    this.cargar();
  }

  abrirCrear(): void {
    this.itemEditar = { nombre: '', tipo: 'I', descripcion: '' };
    this.loadSave = false;
    const modal = document.getElementById('modalFormTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: TipoMovimientoCajaItem): void {
    this.itemEditar = {
      idTipoMovimientoCaja: item.idTipoMovimientoCaja,
      nombre: item.nombre,
      tipo: (item.tipo === 'I' || item.tipo === 'E' ? item.tipo : 'I') as 'I' | 'E',
      descripcion: item.descripcion || ''
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: TipoMovimientoCajaItem): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const nombre = (this.itemEditar.nombre || '').trim();
    if (!nombre) {
      iziToast.warning({ title: 'Validación', message: 'El nombre es obligatorio.' });
      return;
    }
    if (nombre.length > 30) {
      iziToast.warning({ title: 'Validación', message: 'El nombre no puede superar 30 caracteres.' });
      return;
    }
    const tipo: 'I' | 'E' = this.itemEditar.tipo === 'E' ? 'E' : 'I';
    this.loadSave = true;
    const esNuevo = this.itemEditar.idTipoMovimientoCaja == null;
    const body: { nombre: string; descripcion?: string; tipo: 'I' | 'E' } = {
      nombre,
      tipo,
      descripcion: (this.itemEditar.descripcion || '').trim() || undefined
    };
    const req = esNuevo
      ? this.catalogosService.crearTipoMovimiento(body)
      : this.catalogosService.actualizarTipoMovimiento(this.itemEditar.idTipoMovimientoCaja!, body);
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormTipoMov');
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
    this.catalogosService.eliminarTipoMovimiento(item.idTipoMovimientoCaja).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Registro eliminado.' });
        this.cargar();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err.error?.message || 'Error al eliminar.' });
      }
    });
  }

  tipoLabel(tipo: string): string {
    return tipo === 'E' ? 'Egreso' : 'Ingreso';
  }
}
