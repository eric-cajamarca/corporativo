import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FacturacionService } from '../../../services/facturacion.service';
import { EmpresaService } from '../../../services/empresa.service';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare const iziToast: any;

@Component({
  selector: 'app-guias-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarComponent, TopnavComponent],
  templateUrl: './guias-configuracion.component.html',
  styleUrl: './guias-configuracion.component.css'
})
export class GuiasConfiguracionComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);

  private facturacionService = inject(FacturacionService);
  private empresaService = inject(EmpresaService);
  private router = inject(Router);

  /** Solo campos de API guías (no SOAP). Endpoint: POST {urlBaseApiGuias}/v1/contribuyente/gem */
  configuracionGuias: { urlBaseApiGuias: string; idApiGuias: string; claveApiGuias: string } = {
    urlBaseApiGuias: '',
    idApiGuias: '',
    claveApiGuias: ''
  };
  /** Configuración completa para enviar al guardar (evitar pisar otros campos). */
  configuracionCompleta: any = null;
  guardandoConfig = false;
  habilitarGuiasElectronicas = false;
  autorizado = true;

  ngOnInit(): void {
    this.empresaService.getEstadoConfiguracion().subscribe({
      next: (res: any) => {
        this.habilitarGuiasElectronicas = res?.data?.habilitarGuiasElectronicas === true;
        if (!this.habilitarGuiasElectronicas) {
          this.autorizado = false;
          iziToast.warning({
            title: 'No autorizado',
            message: 'Active "Habilitar emisión de guías electrónicas" en Configuración → Facturación.',
            position: 'topRight'
          });
          return;
        }
        this.cargarConfiguracionGuias();
      },
      error: () => {
        this.autorizado = false;
      }
    });
  }

  private cargarConfiguracionGuias(): void {
    this.facturacionService.obtenerConfiguracion().subscribe({
      next: (res: any) => {
        const c = res?.data || {};
        this.configuracionCompleta = c;
        this.configuracionGuias.urlBaseApiGuias = c.urlBaseApiGuias || '';
        this.configuracionGuias.idApiGuias = c.idApiGuias || '';
        this.configuracionGuias.claveApiGuias = '';
      },
      error: () => {
        iziToast.error({
          title: 'Error',
          message: 'No se pudo cargar la configuración',
          position: 'topRight'
        });
      }
    });
  }

  guardarConfiguracionGuias(): void {
    if (!this.configuracionCompleta) {
      iziToast.error({ title: 'Error', message: 'Cargue la configuración antes de guardar.', position: 'topRight' });
      return;
    }
    this.guardandoConfig = true;
    const payload = {
      ...this.configuracionCompleta,
      urlBaseApiGuias: this.configuracionGuias.urlBaseApiGuias || undefined,
      idApiGuias: this.configuracionGuias.idApiGuias || undefined,
      claveApiGuias: this.configuracionGuias.claveApiGuias || undefined
    };
    this.facturacionService.actualizarConfiguracion(payload).subscribe({
      next: () => {
        iziToast.success({ title: 'Guardado', message: 'Configuración de guías guardada.', position: 'topRight' });
        this.configuracionGuias.claveApiGuias = '';
        this.cargarConfiguracionGuias();
      },
      error: (err) => {
        iziToast.error({
          title: 'Error',
          message: err?.error?.message || 'No se pudo guardar la configuración',
          position: 'topRight'
        });
      },
      complete: () => { this.guardandoConfig = false; }
    });
  }

  irAConfiguracion(): void {
    this.router.navigate(['/configuracion'], { queryParams: { tab: 'facturacion' } });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
