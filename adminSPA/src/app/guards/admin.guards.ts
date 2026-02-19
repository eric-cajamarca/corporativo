import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';

/**
 * Guard que restringe el acceso solo al dueño del sistema (rol Administrador).
 * Debe usarse junto con AuthGuard en rutas que solo el super admin puede ver (ej. Empresas).
 */
@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate() {
    return this.authService.verifyToken().pipe(
      map(isValid => {
        if (!isValid) {
          this.router.navigate(['/login-empresa']);
          return false;
        }
        const rol = this.authService.userData()?.rol ?? '';
        if (rol !== 'Administrador') {
          this.router.navigate(['/home']);
          return false;
        }
        return true;
      })
    );
  }
}