import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { TopnavComponent } from '../../topnav/topnav.component';
import { NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { AuditoriaService, AuditoriaItem } from '../../../services/auditoria.service';

@Component({
  selector: 'app-log-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, TopnavComponent, NgbPaginationModule],
  templateUrl: './log-auditoria.component.html',
  styleUrl: './log-auditoria.component.css'
})
export class LogAuditoriaComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);
  items: AuditoriaItem[] = [];
  total = 0;
  page = 1;
  pageSize = 25;
  maxSize = 5;
  loading = false;
  filtros = {
    accion: '',
    fechaDesde: '',
    fechaHasta: ''
  };

  constructor(
    private auditoriaService: AuditoriaService,
    //public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    const params: any = { pagina: this.page, porPagina: this.pageSize };
    if (this.filtros.accion?.trim()) params.accion = this.filtros.accion.trim();
    if (this.filtros.fechaDesde) params.fechaDesde = this.filtros.fechaDesde;
    if (this.filtros.fechaHasta) params.fechaHasta = this.filtros.fechaHasta;

    this.auditoriaService.listar(params).subscribe({
      next: (res) => {
        this.items = res.data || [];
        this.total = res.total ?? 0;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.items = [];
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

  formatearFecha(f: string | null | undefined): string {
    if (!f) return '—';
    return String(f).slice(0, 19).replace('T', ' ');
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
