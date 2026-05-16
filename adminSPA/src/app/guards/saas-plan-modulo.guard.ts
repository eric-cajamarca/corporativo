import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { map, catchError, of, type Observable } from 'rxjs';
import { moduloMenuRequeridoParaUrl } from '../config/ruta-plan-modulo.map';
import { nivelPlan, normalizarRutaAbsoluta } from '../config/saas-plan-reglas.util';
import { PermisosService } from '../services/permisos.service';

function evaluarAccesoPlan(router: Router, url: string, permisos: PermisosService): boolean | UrlTree {
  const abs = normalizarRutaAbsoluta(url.split('?')[0] || '/');

  if (abs === '/inventario/conteo-fisico') {
    return true;
  }

  // #region agent log
  fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e02ca2'},body:JSON.stringify({sessionId:'e02ca2',location:'saas-plan-modulo.guard.ts:9',message:'evaluarAccesoPlan',data:{abs,modulos:permisos.modulosPlanMenu(),plan:permisos.planCodeEfectivo()},timestamp:Date.now(),runId:'debug-run',hypothesisId:'H2'})}).catch(()=>{});
  // #endregion agent log

  if (permisos.deploymentMode() !== 'saas') {
    return true;
  }

  const modulos = permisos.modulosPlanMenu();
  if (!modulos.length) {
    return true;
  }

  const requerido = moduloMenuRequeridoParaUrl(url);
  if (requerido === null) {
    return true;
  }
  const set = new Set(modulos.map((m) => m.toUpperCase()));
  if (!set.has(requerido.toUpperCase())) {
    return router.createUrlTree(['/home']);
  }

  const nv = nivelPlan(permisos.planCodeEfectivo());
  if (abs.startsWith('/cotizaciones')) {
    if (nv < 2) {
      return router.createUrlTree(['/home']);
    }
  }

  const planRaw = permisos.planCodeEfectivo();
  if (abs.startsWith('/compras/comprobantes-sunat')) {
    if (!planRaw || nivelPlan(planRaw) < 2) {
      return router.createUrlTree(['/home']);
    }
  }

  const plan = (permisos.planCodeEfectivo() || '').toLowerCase();
  if (plan === 'demo') {
    if (abs === '/caja' || abs.startsWith('/caja/') || abs === '/creditos' || abs.startsWith('/creditos/')) {
      const okCajaDemo =
        abs === '/caja' || abs === '/caja/arqueo' || abs.startsWith('/caja/arqueo/');
      if (!okCajaDemo) {
        return router.createUrlTree(['/home']);
      }
    }
  }

  return true;
}

/**
 * En modo SaaS, bloquea URLs directas a módulos que no están en `SaasPlanModulo` para el plan efectivo.
 * Si `modulosPlanMenu` está vacío, no aplica tope (compatibilidad).
 */
export const saasPlanModuloGuard: CanActivateFn = (_route, state): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const permisos = inject(PermisosService);
  const router = inject(Router);

  if (!permisos.contextoPlanCargado()) {
    return permisos.cargarPermisosUsuario().pipe(
      map(() => evaluarAccesoPlan(router, state.url, permisos)),
      catchError(() => of(router.createUrlTree(['/home'])))
    );
  }

  return evaluarAccesoPlan(router, state.url, permisos);
};
