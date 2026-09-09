import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Rutas de administración multiempresa: el rol se valida aquí para no pintar la UI;
 * el backend vuelve a comprobar empresa operadora (EMPRESA_PRINCIPAL_ID).
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
      return true;
    })
  );
};
