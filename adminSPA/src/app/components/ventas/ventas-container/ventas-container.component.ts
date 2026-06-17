import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { EmpresaService } from '../../../services/empresa.service';
import { Empresa } from '../../../models/empresa.model';
import { VentasGrifoComponent } from '../ventas-grifo/ventas-grifo.component';
import { VentasHotelesComponent } from '../ventas-hoteles/ventas-hoteles.component';
import { VentasRopaComponent } from '../ventas-ropa/ventas-ropa.component';
import { VentasRestaurantesComponent } from '../ventas-restaurantes/ventas-restaurantes.component';

@Component({
  selector: 'app-ventas-container',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    VentasGrifoComponent,
    VentasHotelesComponent,
    VentasRopaComponent,
    VentasRestaurantesComponent
  ],
  templateUrl: './ventas-container.component.html',
  styleUrl: './ventas-container.component.css'
})
export class VentasContainerComponent implements OnInit {
  codigoRubro: string | null = null;
  rubroEmpresa = '';
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
    // Cargar empresa desde la API para tener codigoRubro actualizado (evita ver listado habitual si el rubro es Hotel/Grifo/etc.)
    this.empresaService.refreshEmpresaFromApi().subscribe({
      next: (emp) => {
        this.codigoRubro = emp?.codigoRubro ?? null;
        this.rubroEmpresa = emp?.rubro ?? '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  /** Vista grifo: código GRF o giro SUNAT con combustible/grifo. */
  esVistaGrifo(): boolean {
    const codigo = String(this.codigoRubro || '').trim().toUpperCase();
    if (codigo === 'GRF' || codigo === 'GRIFO') return true;
    const rubro = String(this.rubroEmpresa || '').trim().toLowerCase();
    return rubro === 'grifo' || rubro.includes('grifo') || rubro.includes('combustible');
  }

  /** Código efectivo para el switch de vistas por rubro. */
  codigoVistaVentas(): string | null {
    if (this.esVistaGrifo()) return 'GRF';
    return this.codigoRubro;
  }
}
