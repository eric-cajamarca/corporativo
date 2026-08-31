import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { EmpresaService } from '../services/empresa.service';
import { esRubroPintura } from '../utils/rubro-empresa.util';

/** Solo empresas con rubro Pintura (PINT) pueden entrar a /matizado. */
export const rubroPinturaGuard: CanActivateFn = () => {
  const empresaService = inject(EmpresaService);
  const router = inject(Router);
  const actual = empresaService.getEmpresaActual();
  if (esRubroPintura(actual?.codigoRubro, actual?.rubro)) {
    return true;
  }
  return empresaService.refreshEmpresaFromApi().pipe(
    map((emp) =>
      esRubroPintura(emp?.codigoRubro, emp?.rubro) ? true : router.createUrlTree(['/home'])
    ),
    catchError(() => of(router.createUrlTree(['/home'])))
  );
};
