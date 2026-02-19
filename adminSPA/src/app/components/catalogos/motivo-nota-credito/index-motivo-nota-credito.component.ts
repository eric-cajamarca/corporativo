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

// Descripciones SUNAT Catálogo 09 (motivo nota de crédito electrónica)
const DESCRIPCIONES_SUNAT: Record<string, string> = {
  '01': 'Anulación de la operación',
  '02': 'Anulación por error en el RUC',
  '03': 'Corrección por error en la descripción',
  '04': 'Descuento global',
  '05': 'Descuento por ítem',
  '06': 'Devolución total',
  '07': 'Devolución por ítem',
  '08': 'Bonificación',
  '09': 'Disminución en el valor',
  '10': 'Otros conceptos',
  '11': 'Ajustes de operaciones de exportación',
  '12': 'Ajustes afectos al IVAP',
  '13': 'Corrección o modificación del monto neto pendiente de pago y/o fechas de vencimiento'
};

@Component({
  selector: 'app-index-motivo-nota-credito',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './index-motivo-nota-credito.component.html',
  styleUrl: './index-motivo-nota-credito.component.css'
})
export class IndexMotivoNotaCreditoComponent implements OnInit {
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
  codigosSunat: string[] = [];

  constructor(
    private catalogosService: CatalogosService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.catalogosService.codigosSunatMotivoNotaCredito().subscribe({
      next: (res) => {
        this.codigosSunat = res.data || [];
      }
    });
    this.cargar();
  }

  descripcionSunat(codigo: string): string {
    return DESCRIPCIONES_SUNAT[codigo] || '';
  }

  cargar(): void {
    this.loading = true;
    this.catalogosService.listarMotivoNotaCredito(this.buscar || undefined, this.page, this.pageSize).subscribe({
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
    this.itemEditar = { codigoSunat: '01', descripcion: DESCRIPCIONES_SUNAT['01'] || '' };
    this.loadSave = false;
    const modal = document.getElementById('modalFormMotivoNC');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirEditar(item: any): void {
    this.itemEditar = {
      idMotivoNotaCredito: item.idMotivoNotaCredito,
      codigoSunat: item.codigoSunat,
      descripcion: item.descripcion
    };
    this.loadSave = false;
    const modal = document.getElementById('modalFormMotivoNC');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  abrirVer(item: any): void {
    this.itemVer = item;
    const modal = document.getElementById('modalVerMotivoNC');
    if (modal && (window as any).bootstrap) new (window as any).bootstrap.Modal(modal).show();
  }

  onCodigoSunatChange(): void {
    const d = DESCRIPCIONES_SUNAT[this.itemEditar.codigoSunat];
    if (d && !this.itemEditar.descripcion) this.itemEditar.descripcion = d;
  }

  guardar(): void {
    const desc = (this.itemEditar.descripcion || '').trim();
    if (!desc) {
      iziToast.warning({ title: 'Validación', message: 'La descripción es obligatoria.' });
      return;
    }
    let cod = (this.itemEditar.codigoSunat || '').trim();
    if (cod.length === 1) cod = '0' + cod;
    if (!this.codigosSunat.includes(cod)) {
      iziToast.warning({ title: 'Validación', message: 'El código SUNAT debe ser del Catálogo 09 (01-13).' });
      return;
    }
    this.loadSave = true;
    const esNuevo = !this.itemEditar.idMotivoNotaCredito;
    const body = { codigoSunat: cod, descripcion: desc };
    const req = esNuevo
      ? this.catalogosService.crearMotivoNotaCredito(body)
      : this.catalogosService.actualizarMotivoNotaCredito(this.itemEditar.idMotivoNotaCredito, body);
    req.subscribe({
      next: () => {
        this.loadSave = false;
        const m = document.getElementById('modalFormMotivoNC');
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
    if (!confirm('¿Eliminar este motivo de nota de crédito?')) return;
    this.catalogosService.eliminarMotivoNotaCredito(item.idMotivoNotaCredito).subscribe({
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
