import { Component, OnInit, effect } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { EmpresaService } from '../../services/empresa.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './topnav.component.html',
  styleUrl: './topnav.component.css'
})
export class TopnavComponent implements OnInit {

  public user: any = {};
  public empConect: any = {};
  public rol: string = "";
  public isAuthenticated: boolean = false;

  constructor(
    private _router: Router,
    private _adminService: AdminService,
    private _empresaService: EmpresaService,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    // Inicializar el servicio de autenticación
    this.authService.initialize();
  }

  private loadUserData(): void {
    // Verificar si el usuario está autenticado usando el computed signal
    this.isAuthenticated = this.authService.isAuthenticated();

    // Acceder directamente al valor del signal
    const userData = this.authService.userData();
    if (userData) {
      this.user = {
        razonSocial: userData.razonSocial,
        nombres: userData.nombres,
        rol: userData.rol
      };
      this.rol = userData.rol || '';
      this.empConect = {
        razonSocial: userData.razonSocial
      };
    } else {
      this.user = {};
      this.rol = '';
      this.empConect = {};
    }

    // Configurar effect para reactividad si los datos cambian
    effect(() => {
      const currentUserData = this.authService.userData();
      if (currentUserData) {
        this.user = {
          razonSocial: currentUserData.razonSocial,
          nombres: currentUserData.nombres,
          rol: currentUserData.rol
        };
        this.rol = currentUserData.rol || '';
        this.empConect = {
          razonSocial: currentUserData.razonSocial
        };
        this.isAuthenticated = true;
      } else {
        this.user = {};
        this.rol = '';
        this.empConect = {};
        this.isAuthenticated = false;
      }
    });
  }

  logout(): void {
    this.authService.forceLogout();
  }

  navigateToProfile(): void {
    // Navegar al perfil del usuario
    this._router.navigate(['/perfil']);
  }

  navigateToSettings(): void {
    // Navegar a configuración
    this._router.navigate(['/configuracion']);
  }

  // Método auxiliar para verificar si el usuario tiene un rol específico
  hasRole(role: string): boolean {
    return this.rol === role;
  }

  // Método auxiliar para obtener datos del usuario de manera segura
  getUserData(): any {
    return this.user || {};
  }
}
