import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { map, of, switchMap, type Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DeploymentContextService } from '../services/deployment-context.service';
import { tieneCheckoutRegistro } from '../utils/saas-registro-origen.util';

/**
 * En SaaS, el registro público de empresa exige haber elegido demo o un plan
 * (/suscribirse/...), que deja `?checkout=` o el respaldo en localStorage.
 * Enterprise no aplica. Sesión iniciada (alta desde el panel) sí puede entrar.
 */
export const saasCrearEmpresaGuard: CanActivateFn = (route): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const router = inject(Router);
  const deployment = inject(DeploymentContextService);
  const auth = inject(AuthService);
  const aPlanes = router.createUrlTree(['/planes'], { queryParams: { registro: 'elige-plan' } });

  return deployment.cargarSiNecesario().pipe(
    switchMap((cfg) => {
      if ((cfg?.deploymentMode || '').toLowerCase() !== 'saas') {
        return of(true);
      }
      if (tieneCheckoutRegistro(route.queryParamMap.get('checkout'))) {
        return of(true);
      }
      return auth.peekSession().pipe(map((ok) => (ok ? true : aPlanes)));
    })
  );
};
