import { Component, signal, TemplateRef } from '@angular/core';
import { SucursalService } from '../../../services/sucursal.service';
import { FormsModule } from '@angular/forms';
import { NgbPagination } from '@ng-bootstrap/ng-bootstrap';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarStateService } from '../../../services/sidebar-state.service';
import { PermisosService } from '../../../services/permisos.service';

declare var bootstrap: any;

@Component({
  selector: 'app-index-sucursal',
  imports: [FormsModule, NgbPagination, RouterModule, CommonModule],
  templateUrl: './index-sucursal.component.html',
  styleUrl: './index-sucursal.component.css'
})
export class IndexSucursalComponent {

  public sucursales: Array<any> = [];

  public token:any;
  public sucursales_const:any = {};
  public load_estado:any = false;

   // Configuración de paginación
  public page = 1;
  public pageSize = 10;
  public maxSize = 10;
  public rotate = true;
  public boundaryLinks = true;

  constructor(
    private _sucursalcervice: SucursalService,
    public sidebarState: SidebarStateService,
    private _permisosService: PermisosService
  ) {
    this.obtenerSucursales();
  }

  ngAfterViewInit(): void {
    var dropdownElementList = [].slice.call(document.querySelectorAll('.dropdown-toggle'));
    var dropdownList = dropdownElementList.map(function (dropdownToggleEl) {
      return new bootstrap.Dropdown(dropdownToggleEl);
    });
  }

  ngOnInit(): void {
    this._permisosService.cargarPermisosUsuario().subscribe({ error: () => {} });
  }

  /** Alta de sucursal/dirección vía «Editar empresa»; desactiva si el plan ya no admite más. */
  etiquetaSeries(s: { idSucursal?: string; nombre?: string; esPrincipal?: boolean | number | string; idSucursalSeriesPadre?: string | null }): string {
    const ep = s?.esPrincipal;
    const esP = !!(ep === true || ep === 1 || ep === '1');
    if (esP) {
      return 'Propias (principal)';
    }
    const pad = s?.idSucursalSeriesPadre;
    if (pad == null || pad === '') {
      return 'Propias';
    }
    const padre = this.sucursales.find((x: { idSucursal: string }) => String(x.idSucursal).toLowerCase() === String(pad).toLowerCase());
    return padre ? `Compartidas (${padre.nombre})` : 'Compartidas';
  }

  puedeIrCrearNuevaSucursal(): boolean {
    const lp = this._permisosService.limitesPlan();
    if (!lp) {
      return true;
    }
    return lp.puedeAgregarDireccionEmpresa !== false || lp.puedeCrearSucursal !== false;
  }

  obtenerSucursales(){
    this._sucursalcervice.obtener_sucursal_todos(true).subscribe(
      response=>{
        this.sucursales = response.data || [];
        this.sucursales_const = [...this.sucursales];
        //console.log('sucursales',this.sucursales);
      },
      error=>{
      }
    )
  }

  actualizarEstado(id: string, estado: boolean | number): void {
    this.load_estado = true;
    this._sucursalcervice.editar_estado_idsucursal(id, { estado }).subscribe({
      next: () => {
        this.load_estado = false;
        this.obtenerSucursales();
      },
      error: (err) => {
        this.load_estado = false;
      }
    });
  }

  establecerPrincipal(id: string): void {
    this.load_estado = true;
    this._sucursalcervice.establecer_sucursal_principal(id).subscribe({
      next: () => {
        this.load_estado = false;
        this.obtenerSucursales();
      },
      error: (err) => {
        this.load_estado = false;
      }
    });
  }

  

   onPageChange(newPage: number) {
    this.page = newPage;
    // Puedes agregar lógica adicional aquí si necesitas
    // cargar más datos cuando cambia la página
  }
}
