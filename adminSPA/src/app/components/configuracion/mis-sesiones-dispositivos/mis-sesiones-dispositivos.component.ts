import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminService, SesionDispositivoDto } from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';
import { SidebarStateService } from '../../../services/sidebar-state.service';

declare var iziToast: { error: (opts: object) => void; success: (opts: object) => void };

@Component({
  selector: 'app-mis-sesiones-dispositivos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-sesiones-dispositivos.component.html',
  styleUrl: './mis-sesiones-dispositivos.component.css'
})
export class MisSesionesDispositivosComponent implements OnInit {
  sesiones = signal<SesionDispositivoDto[]>([]);
  cargando = signal(true);
  accionId = signal<string | null>(null);

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    public sidebarState: SidebarStateService
  ) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.adminService.listarSesionesDispositivos().subscribe({
      next: (res) => {
        this.sesiones.set(res.data || []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        iziToast.error({ title: 'Error', message: 'No se pudieron cargar las sesiones.' });
      }
    });
  }

  revocar(s: SesionDispositivoDto): void {
    this.accionId.set(s.idRefresh);
    this.adminService.revocarSesionDispositivo(s.idRefresh).subscribe({
      next: (res) => {
        this.accionId.set(null);
        iziToast.success({ title: 'Listo', message: res.message || 'Sesión cerrada' });
        if (res.data?.cerroCookies) {
          this.authService.forceLogout();
          return;
        }
        this.cargar();
      },
      error: () => {
        this.accionId.set(null);
        iziToast.error({ title: 'Error', message: 'No se pudo cerrar la sesión.' });
      }
    });
  }

  revocarOtras(): void {
    this.accionId.set('__otras__');
    this.adminService.revocarOtrasSesionesDispositivos().subscribe({
      next: (res) => {
        this.accionId.set(null);
        iziToast.success({ title: 'Listo', message: res.message || 'Otras sesiones cerradas' });
        this.cargar();
      },
      error: (err) => {
        this.accionId.set(null);
        const msg = err?.error?.message || 'No se pudo completar la acción.';
        iziToast.error({ title: 'Error', message: msg });
      }
    });
  }

  hayOtrasActivas(): boolean {
    const list = this.sesiones();
    return list.some((x) => !x.esDispositivoActual);
  }
}
