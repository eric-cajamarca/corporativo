import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EmpresaService } from '../../../services/empresa.service';

declare const iziToast: any;

@Component({
  selector: 'app-guias-transportista',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guias-transportista.component.html',
  styleUrl: './guias-transportista.component.css'
})
export class GuiasTransportistaComponent implements OnInit {

  private empresaService = inject(EmpresaService);
  private router = inject(Router);

  autorizado = true;

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res: any) => {
        this.autorizado = res?.data?.habilitarGuiasElectronicas === true;
        if (!this.autorizado) {
          iziToast.warning({
            title: 'No autorizado',
            message: 'Active "Habilitar emisión de guías electrónicas" en Configuración → Facturación.',
            position: 'topRight'
          });
        }
      },
      error: () => {
        this.autorizado = false;
      }
    });
  }

  irAConfiguracion(): void {
    this.router.navigate(['/configuracion'], { queryParams: { tab: 'facturacion' } });
  }
}
