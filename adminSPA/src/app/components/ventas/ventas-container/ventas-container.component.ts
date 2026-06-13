import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { VentasGrifoComponent } from '../ventas-grifo/ventas-grifo.component';
import { VentasHotelesComponent } from '../ventas-hoteles/ventas-hoteles.component';

/** Rubros con pantalla vertical dedicada en /ventas (histórico). El resto usa POS estándar. */
const RUBROS_LEGACY_VERTICAL = new Set(['ROPA', 'REST', 'FERR', 'RETAIL']);

@Component({
  selector: 'app-ventas-container',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    VentasGrifoComponent,
    VentasHotelesComponent
  ],
  templateUrl: './ventas-container.component.html',
  styleUrl: './ventas-container.component.css'
})
export class VentasContainerComponent implements OnInit {
  codigoRubro: string | null = null;
  loading = true;

  constructor(
    private empresaService: EmpresaService,
    private router: Router
  ) {}

  /** True si la ruta actual es una ruta hija de ventas (create, detalle, editar) para mostrar el outlet. */
  get isChildRoute(): boolean {
    const url = this.router.url;
    return (
      url.includes('/ventas/create') ||
      url.includes('/ventas/rapida') ||
      url.includes('/ventas/detalle/') ||
      url.includes('/ventas/editar/') ||
      url.includes('/ventas/reporte-detallado')
    );
  }

  ngOnInit(): void {
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        this.codigoRubro = this.normalizarCodigoRubro(emp?.codigoRubro ?? null);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /** GEN/FERR/RETAIL/null → POS estándar; GRF/HOTEL → módulo vertical. */
  private normalizarCodigoRubro(codigo: string | null): string | null {
    const c = (codigo ?? '').trim().toUpperCase();
    if (!c || c === 'GEN' || RUBROS_LEGACY_VERTICAL.has(c)) return null;
    if (c === 'GRIFO') return 'GRF';
    return c;
  }
}
