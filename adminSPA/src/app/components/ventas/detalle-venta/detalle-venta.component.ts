import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { VentasService, ComprobantePdfData } from '../../../services/ventas.service';

@Component({
  selector: 'app-detalle-venta',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, TopnavComponent],
  templateUrl: './detalle-venta.component.html',
  styleUrl: './detalle-venta.component.css'
})
export class DetalleVentaComponent implements OnInit {
  sidebarCollapsed = signal<boolean>(false);
  data: ComprobantePdfData | null = null;
  loading = true;
  idVenta: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ventasService: VentasService
  ) {}

  ngOnInit(): void {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') this.sidebarCollapsed.set(true);
    const id = this.route.snapshot.paramMap.get('id');
    this.idVenta = id ? parseInt(id, 10) : null;
    if (this.idVenta == null || isNaN(this.idVenta)) {
      this.loading = false;
      return;
    }
    this.ventasService.getComprobanteParaPdf(this.idVenta).subscribe({
      next: (res) => {
        this.data = res.data ?? null;
        this.loading = false;
      },
      error: () => {
        this.data = null;
        this.loading = false;
      }
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarCollapsed.set(collapsed);
  }

  formatearMoneda(value: number | undefined): string {
    if (value == null) return 'S/ 0.00';
    return 'S/ ' + Number(value).toFixed(2);
  }

  formatearFecha(f: string | undefined): string {
    if (!f) return '—';
    return String(f).slice(0, 19).replace('T', ' ');
  }

  puedeEditar(): boolean {
    const id = this.data?.venta?.idEstadoSunat;
    return id !== 1 && id !== 2 && id !== 3;
  }

  editar(): void {
    if (this.idVenta && this.puedeEditar()) {
      this.router.navigate(['/ventas/editar', this.idVenta]);
    }
  }

  volver(): void {
    this.router.navigate(['/ventas']);
  }
}
