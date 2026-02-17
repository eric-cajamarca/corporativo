import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CatalogosService } from '../../../services/catalogos.service';

declare var iziToast: any;

@Component({
  selector: 'app-index-motivo-traslado',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-motivo-traslado.component.html',
  styleUrl: './index-motivo-traslado.component.css'
})
export class IndexMotivoTrasladoComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);
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

  constructor(private catalogosService: CatalogosService) {}

  ngOnInit(): void {
    const collapsed = localStorage.getItem('sidebarCollapsed');
    if (collapsed === 'true') this.sidebarCollapsed.set(true);
    this.cargar();
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarMotivoTraslado(this.buscar || undefined, this.page, this.pageSize).subscribe({
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
    this.itemEditar = { descripcion: '' };
    this.loadSave = false;
    const modal = document.getElementById('modalFormMotivoTraslado');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: any): void {
    this.itemEditar = { idMotivoTraslado: item.idMotivoTraslado, descripcion: item.descripcion };
    this.loadSave = false;
    const modal = document.getElementById('modalFormMotivoTraslado');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: any): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerMotivoTraslado');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const desc = (this.itemEditar.descripcion || '').trim();
    if (!desc) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idMotivoTraslado;
    const req = esNuevo
      ? this.catalogosService.crearMotivoTraslado({ descripcion: desc })
      : this.catalogosService.actualizarMotivoTraslado(this.itemEditar.idMotivoTraslado, { descripcion: desc });
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormMotivoTraslado');
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
    if (!confirm('¿Eliminar este motivo de traslado?')) return;
    this.catalogosService.eliminarMotivoTraslado(item.idMotivoTraslado).subscribe({
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
