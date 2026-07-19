import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, SesionDispositivoItem } from '../../../services/admin.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: any;

@Component({
  selector: 'app-mis-sesiones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-sesiones.component.html',
  styleUrl: './mis-sesiones.component.css'
})
export class MisSesionesComponent implements OnInit {
  cargando = false;
  sesiones: SesionDispositivoItem[] = [];

  constructor(
    private adminService: AdminService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.adminService.listarSesionesDispositivos().subscribe({
      next: (res) => {
        this.sesiones = res.data || [];
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las sesiones.' });
      }
    });
  }

  revocarSesion(s: SesionDispositivoItem): void {
    if (!confirm('¿Cerrar esta sesión en el otro dispositivo?')) {
      return;
    }
    this.adminService.revocarSesionDispositivo(s.idRefresh).subscribe({
      next: () => {
        iziToast.success({ title: 'Listo', message: 'Sesión cerrada.' });
        this.cargar();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo cerrar la sesión.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  revocarOtras(): void {
    if (!confirm('¿Cerrar todas las sesiones excepto la de este navegador?')) {
      return;
    }
    this.adminService.revocarOtrasSesionesDispositivos().subscribe({
      next: () => {
        iziToast.success({ title: 'Listo', message: 'Las demás sesiones fueron cerradas.' });
        this.cargar();
      },
      error: (err) => {
        const msg = err?.error?.message || 'No se pudo completar la acción.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }
}
