import { Component, OnInit, Type, signal } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { VentasRopaComponent } from '../ventas-ropa/ventas-ropa.component';
import { VentasRestaurantesComponent } from '../ventas-restaurantes/ventas-restaurantes.component';

/** Rubros con pantalla vertical dedicada en /ventas (histórico). El resto usa POS estándar. */
const RUBROS_LEGACY_VERTICAL = new Set(['ROPA', 'REST', 'FERR', 'RETAIL']);

@Component({
  selector: 'app-ventas-container',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NgComponentOutlet, VentasRopaComponent, VentasRestaurantesComponent],
  templateUrl: './ventas-container.component.html',
  styleUrl: './ventas-container.component.css'
})
export class VentasContainerComponent implements OnInit {
  codigoRubro: string | null = null;
  rubroEmpresa = '';
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
    const cod = this.codigoVistaVentas();
    return cod === 'GRF' || cod === 'HOTEL';
  }

  ngOnInit(): void {
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        this.codigoRubro = this.normalizarCodigoRubro(emp?.codigoRubro ?? null);
        this.rubroEmpresa = emp?.rubro ?? '';
        void this.cargarComponenteRubro(this.codigoVistaVentas()).finally(() => {
          this.loading = false;
        });
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /**
   * Vista grifo solo por código de sistema (GRF).
   * No inferir por texto SUNAT: GEN se normaliza a null y el giro puede decir
   * "combustible/grifo" sin ser rubro GRF (p. ej. tras cambiar en Editar empresa).
   */
  esVistaGrifo(): boolean {
    const codigo = String(this.codigoRubro || '').trim().toUpperCase();
    return codigo === 'GRF' || codigo === 'GRIFO';
  }

  /** Código efectivo para el switch de vistas por rubro. */
  codigoVistaVentas(): string | null {
    if (this.esVistaGrifo()) return 'GRF';
    return this.codigoRubro;
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
