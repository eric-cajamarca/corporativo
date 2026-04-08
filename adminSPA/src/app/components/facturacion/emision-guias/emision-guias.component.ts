import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FacturacionService, GuiaEmitidaListItem } from '../../../services/facturacion.service';
import { EmpresaService } from '../../../services/empresa.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';

declare const iziToast: { warning: (o: object) => void; error: (o: object) => void; info: (o: object) => void };

@Component({
  selector: 'app-emision-guias',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopnavComponent, NgbPagination],
  templateUrl: './emision-guias.component.html',
  styleUrl: './emision-guias.component.css'
})
export class EmisionGuiasComponent implements OnInit {
  sidebarState = inject(SidebarStateService);
  private facturacionService = inject(FacturacionService);
  private empresaService = inject(EmpresaService);

  autorizado = true;
  loading = false;
  items: GuiaEmitidaListItem[] = [];
  total = 0;
  page = 1;
  readonly pageSize = 10;
  readonly maxSize = 5;

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res: { data?: { habilitarGuiasElectronicas?: boolean } }) => {
        this.autorizado = res?.data?.habilitarGuiasElectronicas === true;
        if (!this.autorizado && typeof iziToast !== 'undefined') {
          iziToast.warning({
            title: 'Guías',
            message: 'Active la emisión de guías en Configuración → Facturación.',
            position: 'topRight'
          });
        }
        if (this.autorizado) {
          this.cargar();
        }
      },
      error: () => {
        this.autorizado = false;
      }
    });
  }

  cargar(): void {
    this.loading = true;
    this.facturacionService
      .listarGuiasEmitidas({ pagina: this.page, porPagina: this.pageSize })
      .subscribe({
        next: (res) => {
          this.items = res?.data ?? [];
          this.total = res?.total ?? 0;
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          this.items = [];
          this.total = 0;
          const msg =
            err?.error?.message ||
            'No se pudo cargar el listado de guías. Si acaba de desplegar el sistema, ejecute la migración de la tabla GuiasElectronicasEmitidas.';
          if (typeof iziToast !== 'undefined') {
            iziToast.error({ title: 'Error', message: msg, position: 'topRight' });
          }
        }
      });
  }

  onPageChange(p: number): void {
    this.page = p;
    this.cargar();
  }

  etiquetaTipoDocumento(cod: string): string {
    const c = (cod || '').trim();
    if (c === '09') return 'GRE Remitente';
    if (c === '31') return 'Guía transportista';
    return c || '—';
  }

  etiquetaEstado(row: GuiaEmitidaListItem): string {
    if (row.descripcionEstado) return row.descripcionEstado;
    if (row.idEstadoSunat == null) return '—';
    return String(row.idEstadoSunat);
  }

  docOrigen(row: GuiaEmitidaListItem): string {
    const s = (row.comprobanteOrigenSerie || '').trim();
    const n = (row.comprobanteOrigenNumero || '').trim();
    if (s && n) return `${s}-${n}`;
    if (s) return s;
    if (n) return n;
    return '—';
  }
}
