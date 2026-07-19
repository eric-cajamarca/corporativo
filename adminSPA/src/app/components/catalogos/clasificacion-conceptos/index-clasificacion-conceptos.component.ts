import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CatalogosService } from '../../../services/catalogos.service';

declare var iziToast: any;

export interface ClasificacionConceptoItem {
  idClasificacionConcepto: string;
  descripcion: string;
}

@Component({
  selector: 'app-index-clasificacion-conceptos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NgbPagination],
  templateUrl: './index-clasificacion-conceptos.component.html',
  styleUrl: './index-clasificacion-conceptos.component.css'
})
export class IndexClasificacionConceptosComponent implements OnInit {
  items: ClasificacionConceptoItem[] = [];
  total = 0;
  buscar = '';
  page = 1;
  pageSize = 10;
  maxSize = 5;
  loading = false;
  itemEditar: Partial<ClasificacionConceptoItem> & { descripcion?: string } = {};
  itemVer: ClasificacionConceptoItem | null = null;
  loadSave = false;

  constructor(
    private catalogosService: CatalogosService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarClasificacionConceptos(this.buscar || undefined, this.page, this.pageSize).subscribe({
      next: (res) => {
        this.items = (res.data || []) as ClasificacionConceptoItem[];
        this.total = res.total ?? this.items.length;
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
    const modal = document.getElementById('modalFormClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: ClasificacionConceptoItem): void {
    this.itemEditar = {
      idClasificacionConcepto: item.idClasificacionConcepto,
      descripcion: item.descripcion || ''
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: ClasificacionConceptoItem): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerClasif');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const descripcion = (this.itemEditar.descripcion || '').trim();
    if (!descripcion) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idClasificacionConcepto;
    const body = { descripcion };
    const req = esNuevo
      ? this.catalogosService.crearClasificacionConcepto(body)
      : this.catalogosService.actualizarClasificacionConcepto(this.itemEditar.idClasificacionConcepto!, body);
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

  confirmarEliminar(item: ClasificacionConceptoItem): void {
    if (!confirm('¿Eliminar esta clasificación? Los conceptos que la usen quedarán sin clasificación.')) return;
    this.catalogosService.eliminarClasificacionConcepto(item.idClasificacionConcepto).subscribe({
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
