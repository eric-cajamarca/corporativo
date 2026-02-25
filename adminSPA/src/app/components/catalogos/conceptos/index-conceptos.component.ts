import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { CatalogosService } from '../../../services/catalogos.service';
import { CajaService } from '../../../services/caja.service';

declare var iziToast: any;

@Component({
  selector: 'app-index-conceptos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-conceptos.component.html',
  styleUrl: './index-conceptos.component.css'
})
export class IndexConceptosComponent implements OnInit {
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
  /** Clasificación de conceptos (ClasificacionConcepto) por empresa */
  clasificaciones: any[] = [];
  /** Tipos de movimiento de caja (TiposMovimientoCaja) para arqueo */
  tiposMovimientoCaja: any[] = [];
  tipos = ['INGRESO', 'EGRESO'];

  constructor(
    private catalogosService: CatalogosService,
    private cajaService: CajaService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargarClasificaciones();
    this.cargarTiposMovimientoCaja();
    this.cargar();
  }

  cargarClasificaciones(): void {
    this.catalogosService.listarClasificacionConceptos(undefined, 1, 500).subscribe({
      next: (res) => {
        this.clasificaciones = res.data || [];
      }
    });
  }

  cargarTiposMovimientoCaja(): void {
    this.cajaService.obtenerTiposMovimiento().subscribe({
      next: (res) => {
        this.tiposMovimientoCaja = res.data || [];
      }
    });
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarConceptos(this.buscar || undefined, this.page, this.pageSize).subscribe({
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
    this.itemEditar = { descripcion: '', tipo: 'EGRESO', idClasificacionConcepto: null, idTipoMovimientoCaja: null };
    this.loadSave = false;
    const modal = document.getElementById('modalFormConcepto');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: any): void {
    this.itemEditar = {
      idConcepto: item.idConcepto,
      descripcion: item.descripcion,
      tipo: item.tipo || 'EGRESO',
      idClasificacionConcepto: item.idClasificacionConcepto ?? null,
      idTipoMovimientoCaja: item.idTipoMovimientoCaja ?? null
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormConcepto');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: any): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerConcepto');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  guardar(): void {
    const desc = (this.itemEditar.descripcion || '').trim();
    if (!desc) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    if (!this.tipos.includes(this.itemEditar.tipo)) {
      iziToast.warning({ title: 'Validación', message: 'El tipo debe ser INGRESO o EGRESO.' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idConcepto;
    const body = {
      descripcion: desc,
      tipo: this.itemEditar.tipo,
      idClasificacionConcepto: this.itemEditar.idClasificacionConcepto ?? null,
      idTipoMovimientoCaja: this.itemEditar.idTipoMovimientoCaja ?? null
    };
    const req = esNuevo
      ? this.catalogosService.crearConcepto(body)
      : this.catalogosService.actualizarConcepto(this.itemEditar.idConcepto, body);
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormConcepto');
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
    if (!confirm('¿Eliminar este concepto?')) return;
    this.catalogosService.eliminarConcepto(item.idConcepto).subscribe({
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
