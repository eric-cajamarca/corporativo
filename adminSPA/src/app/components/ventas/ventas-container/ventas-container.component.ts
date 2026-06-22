import { Component, OnInit, Type, signal } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';

/** Rubros con pantalla vertical dedicada en /ventas (histórico). El resto usa POS estándar. */
const RUBROS_LEGACY_VERTICAL = new Set(['ROPA', 'REST', 'FERR', 'RETAIL']);

@Component({
  selector: 'app-ventas-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NgComponentOutlet],
  templateUrl: './ventas-container.component.html',
  styleUrl: './ventas-container.component.css'
})
export class VentasContainerComponent implements OnInit {
  codigoRubro: string | null = null;
  loading = true;
  rubroComponent = signal<Type<unknown> | null>(null);
  cargandoRubro = signal(false);

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

  get usaModuloRubroLazy(): boolean {
    return this.codigoRubro === 'GRF' || this.codigoRubro === 'HOTEL';
  }

  ngOnInit(): void {
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        this.codigoRubro = this.normalizarCodigoRubro(emp?.codigoRubro ?? null);
        void this.cargarComponenteRubro(this.codigoRubro).finally(() => {
          this.loading = false;
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private async cargarComponenteRubro(codigo: string | null): Promise<void> {
    this.rubroComponent.set(null);
    if (codigo !== 'GRF' && codigo !== 'HOTEL') {
      return;
    }
    this.cargandoRubro.set(true);
    try {
      if (codigo === 'GRF') {
        const mod = await import('../ventas-grifo/ventas-grifo.component');
        this.rubroComponent.set(mod.VentasGrifoComponent);
      } else {
        const mod = await import('../ventas-hoteles/ventas-hoteles.component');
        this.rubroComponent.set(mod.VentasHotelesComponent);
      }
    } finally {
      this.cargandoRubro.set(false);
    }
  }

  /** GEN/FERR/RETAIL/null → POS estándar; GRF/HOTEL → módulo vertical. */
  private normalizarCodigoRubro(codigo: string | null): string | null {
    const c = (codigo ?? '').trim().toUpperCase();
    if (!c || c === 'GEN' || RUBROS_LEGACY_VERTICAL.has(c)) return null;
    if (c === 'GRIFO') return 'GRF';
    return c;
  }
}
