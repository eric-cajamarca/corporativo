import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { RubrosService, Rubro, ConfiguracionRubroItem } from '../../../services/rubros.service';

@Component({
  selector: 'app-index-rubros',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './index-rubros.component.html',
  styleUrl: './index-rubros.component.css'
})
export class IndexRubrosComponent implements OnInit {
  public sidebarState = inject(SidebarStateService);
  rubros: Rubro[] = [];
  loading = true;
  rubroSeleccionado: Rubro | null = null;
  configuracion: ConfiguracionRubroItem[] = [];
  configCargando = false;
  configGuardando = false;

  constructor(
    //public sidebarState: SidebarStateService,
    private rubrosService: RubrosService
  ) {}

  ngOnInit(): void {
    this.cargarRubros();
  }

  cargarRubros(): void {
    this.loading = true;
    this.rubrosService.listar({ activo: true }).subscribe({
      next: (res) => {
        this.rubros = res.data || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  seleccionarRubro(r: Rubro): void {
    this.rubroSeleccionado = r;
    this.configuracion = [];
    this.configCargando = true;
    this.rubrosService.listarConfiguracion(r.idRubro).subscribe({
      next: (res) => {
        this.configuracion = res.data || [];
        this.configCargando = false;
      },
      error: () => {
        this.configCargando = false;
      }
    });
  }

  guardarConfiguracion(): void {
    if (!this.rubroSeleccionado) return;
    this.configGuardando = true;
    this.rubrosService.guardarConfiguracion(this.rubroSeleccionado.idRubro, this.configuracion).subscribe({
      next: () => {
        this.configGuardando = false;
      },
      error: () => {
        this.configGuardando = false;
      }
    });
  }

  agregarFilaConfig(): void {
    this.configuracion.push({ idRubro: this.rubroSeleccionado!.idRubro, clave: '', valor: '' });
  }

  quitarFilaConfig(i: number): void {
    this.configuracion.splice(i, 1);
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }
}
