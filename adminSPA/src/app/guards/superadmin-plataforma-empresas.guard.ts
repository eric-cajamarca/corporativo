import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

function normalizarGuid(v: string | null | undefined): string {
  return String(v || '')
    .trim()
    .replace(/[{}]/g, '')
    .toLowerCase();
}

/**
 * Listado /empresa (plataforma): solo superAdmin y, si environment.empresaPrincipalId está definido,
 * sesión de esa empresa. Debe coincidir con puedeAccesoListadoPlataformaEmpresas en el backend.
 */
export const superAdminPlataformaEmpresasGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.verifyToken().pipe(
    map((ok) => {
      if (!ok) {
        router.navigate(['/login-empresa']);
        return false;
      }
      const u = auth.userData();
      if (!u || u.rol !== 'superAdmin') {
        router.navigate(['/home']);
        return false;
      }
      const esperado = environment.empresaPrincipalId?.trim();
      if (esperado) {
        const actual = u.idEmpresa ? normalizarGuid(u.idEmpresa) : '';
        if (!actual || actual !== normalizarGuid(esperado)) {
          router.navigate(['/home']);
          return false;
        }
      }
      return true;
    })
  );
};
