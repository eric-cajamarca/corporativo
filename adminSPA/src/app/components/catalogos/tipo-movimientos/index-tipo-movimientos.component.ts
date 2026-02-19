import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CatalogosService } from '../../../services/catalogos.service';

declare var iziToast: any;

@Component({
  selector: 'app-index-tipo-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-tipo-movimientos.component.html',
  styleUrl: './index-tipo-movimientos.component.css'
})
export class IndexTipoMovimientosComponent implements OnInit {
  items: any[] = [];
  total = 0;
  buscar = '';
  page = 1;
  pageSize = 10;
  maxSize = 5;
  loading = false;
  itemEditar: any = {};
  itemVer: any = null;
  loadSave = false;
  tipos = ['INGRESO', 'SALIDA'];

  constructor(
    private catalogosService: CatalogosService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarTipoMovimientos(this.buscar || undefined, this.page, this.pageSize).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.total = res.total ?? 0;
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
    this.cargar();
  }

  abrirCrear(): void {
    this.itemEditar = { descripcion: '', tipo: 'INGRESO', descripcionCorta: '' };
    this.loadSave = false;
    const modal = document.getElementById('modalFormTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: any): void {
    this.itemEditar = {
      idTipoMovimiento: item.idTipoMovimiento,
      descripcion: item.descripcion,
      tipo: item.tipo || 'INGRESO',
      descripcionCorta: item.descripcionCorta || ''
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: any): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerTipoMov');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const desc = (this.itemEditar.descripcion || '').trim();
    if (!desc) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    if (!this.tipos.includes(this.itemEditar.tipo)) {
      iziToast.warning({ title: 'Validación', message: 'El tipo debe ser INGRESO o SALIDA.' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idTipoMovimiento;
    const body = {
      descripcion: desc,
      tipo: this.itemEditar.tipo,
      descripcionCorta: (this.itemEditar.descripcionCorta || '').trim() || undefined
    };
    const req = esNuevo
      ? this.catalogosService.crearTipoMovimiento(body)
      : this.catalogosService.actualizarTipoMovimiento(this.itemEditar.idTipoMovimiento, body);
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

  confirmarEliminar(item: any): void {
    if (!confirm('¿Eliminar este tipo de movimiento?')) return;
    this.catalogosService.eliminarTipoMovimiento(item.idTipoMovimiento).subscribe({
      next: () => {
        iziToast.success({ title: 'Éxito', message: 'Registro eliminado.' });
        this.cargar();
      },
      error: (err) => {
        iziToast.error({ title: 'Error', message: err.error?.message || 'Error al eliminar.' });
      }
    });
  }
}
