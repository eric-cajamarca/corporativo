import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SucursalService } from '../../../services/sucursal.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TopnavComponent } from '../../topnav/topnav.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { FormatSentenceDirective } from '../../../format-sentence.directive';
import { Sucursal } from '../../../interfaces/sucursal-interface';

declare var iziToast: any;

@Component({
  selector: 'app-update-sucursal',
  imports: [FormsModule, RouterModule, CommonModule, TopnavComponent, SidebarComponent, FormatSentenceDirective],
  templateUrl: './update-sucursal.component.html',
  styleUrl: './update-sucursal.component.css'
})
export class UpdateSucursalComponent implements OnInit {
  public sucursal: Partial<Sucursal> = {};
  public otrasSucursales: Array<{ idSucursal: string; nombre: string }> = [];
  public id = '';
  public load_data = false;

  constructor(
    private _Route: ActivatedRoute,
    private _sucursalService: SucursalService,
    private _router: Router,
    public sidebarState: SidebarStateService
  ) {}

  compareSucursalId(a: unknown, b: unknown): boolean {
    if (a == null && b == null) return true;
    if (a == null || b == null) return false;
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  ngOnInit(): void {
    this._Route.params.subscribe((params) => {
      this.id = params['id'];
      this._sucursalService.obtener_sucursal_idempresa(true).subscribe({
        next: (response) => {
          const list = response?.data || [];
          const found = list.find((s: { idSucursal: string }) => s.idSucursal === this.id);
          if (!found) {
            iziToast.show({
              title: 'ERROR',
              titleColor: '#FF0000',
              color: '#FFF',
              class: 'text-danger',
              position: 'topRight',
              message: 'Sucursal no encontrada'
            });
            void this._router.navigate(['/sucursal']);
            return;
          }
          this.sucursal = { ...found };
          if (this.sucursal.idSucursalSeriesPadre == null || this.sucursal.idSucursalSeriesPadre === '') {
            this.sucursal.idSucursalSeriesPadre = null;
          }
          this.otrasSucursales = list
            .filter((s: { idSucursal: string }) => s.idSucursal !== this.id)
            .map((s: { idSucursal: string; nombre: string }) => ({
              idSucursal: s.idSucursal,
              nombre: s.nombre
            }));
        },
        error: () => {
          iziToast.show({
            title: 'ERROR',
            titleColor: '#FF0000',
            color: '#FFF',
            class: 'text-danger',
            position: 'topRight',
            message: 'Error al cargar sucursales'
          });
        }
      });
    });
  }

  onSidebarToggle(collapsed: boolean): void {
    this.sidebarState.setCollapsed(collapsed);
  }

  get esPrincipal(): boolean {
    const ep = this.sucursal.esPrincipal;
    return !!(ep === true || ep === 1 || ep === '1');
  }

  actualizar(_updateForm: unknown): void {
    this.load_data = true;
    const idSucursal = String(this.sucursal.idSucursal || this.id);
    const payload = {
      idSucursal,
      nombre: this.sucursal.nombre,
      direccion: this.sucursal.direccion ?? '',
      idSucursalSeriesPadre: this.esPrincipal ? null : this.sucursal.idSucursalSeriesPadre
    };
    this._sucursalService.editar_sucursal_idEmpresa(payload).subscribe({
      next: () => {
        this.load_data = false;
        iziToast.show({
          title: 'SUCCESS',
          titleColor: '#1DC74C',
          color: '#FFF',
          class: 'text-success',
          position: 'topRight',
          message: 'Sucursal actualizada correctamente.'
        });
        void this._router.navigate(['/sucursal']);
      },
      error: () => {
        this.load_data = false;
        iziToast.show({
          title: 'ERROR',
          titleColor: '#FF0000',
          color: '#FFF',
          class: 'text-danger',
          position: 'topRight',
          message: 'Error al actualizar la sucursal.'
        });
      }
    });
  }
}
