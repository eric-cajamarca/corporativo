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
declare var bootstrap: any;

@Component({
  selector: 'app-index-forma-pago',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-forma-pago.component.html',
  styleUrl: './index-forma-pago.component.css'
})
export class IndexFormaPagoComponent implements OnInit {
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
  tipos = ['EFECTIVO', 'DIGITAL', 'BANCARIO', 'TARJETA'];

  constructor(
    private catalogosService: CatalogosService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarFormaPago(this.buscar || undefined, this.page, this.pageSize).subscribe({
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
    this.itemEditar = { descripcion: '', tipo: 'EFECTIVO', requiereReferencia: false, activo: true };
    this.loadSave = false;
    const modal = document.getElementById('modalFormFormaPago');
    if (modal) {
      const b = (window as any).bootstrap;
      if (b) new b.Modal(modal).show();
    }
  }

  abrirEditar(item: any): void {
    this.itemEditar = {
      idFormaPago: item.idFormaPago,
      descripcion: item.descripcion,
      tipo: item.tipo || 'EFECTIVO',
      requiereReferencia: !!item.requiereReferencia,
      activo: !!item.activo
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormFormaPago');
    if (modal) {
      const b = (window as any).bootstrap;
      if (b) new b.Modal(modal).show();
    }
  }

  abrirVer(item: any): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerFormaPago');
    if (modal) {
      const b = (window as any).bootstrap;
      if (b) new b.Modal(modal).show();
    }
  }

  guardar(): void {
    const desc = (this.itemEditar.descripcion || '').trim();
    if (!desc) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idFormaPago;
    const body = {
      descripcion: desc,
      tipo: this.itemEditar.tipo || 'EFECTIVO',
      requiereReferencia: !!this.itemEditar.requiereReferencia,
      activo: this.itemEditar.activo !== false
    };
    const req = esNuevo
      ? this.catalogosService.crearFormaPago(body)
      : this.catalogosService.actualizarFormaPago(String(this.itemEditar.idFormaPago), body);
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormFormaPago');
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
    if (!confirm('¿Eliminar esta forma de pago?')) return;
    this.catalogosService.eliminarFormaPago(item.idFormaPago).subscribe({
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
