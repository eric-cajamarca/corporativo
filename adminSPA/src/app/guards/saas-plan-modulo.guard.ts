import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';
import { map, catchError, of, type Observable } from 'rxjs';
import { moduloMenuRequeridoParaUrl } from '../config/ruta-plan-modulo.map';
import { normalizarRutaAbsoluta, planPermiteWhatsAppBot, planPermiteWhatsAppVinculado } from '../config/saas-plan-reglas.util';
import { PermisosService } from '../services/permisos.service';

function evaluarAccesoPlan(router: Router, url: string, permisos: PermisosService): boolean | UrlTree {
  const abs = normalizarRutaAbsoluta(url.split('?')[0] || '/');

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

  const planRaw = permisos.planCodeEfectivo();

  if (abs.startsWith('/configuracion/whatsapp-bot')) {
    if (!planPermiteWhatsAppBot(planRaw)) {
      // #region agent log
      fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'saas-plan-modulo.guard.ts:home',message:'saas guard redirect home',data:{url:abs,reason:'whatsapp-bot'},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return router.createUrlTree(['/home']);
    }
  } else if (abs.startsWith('/configuracion/whatsapp')) {
    if (!planPermiteWhatsAppVinculado(planRaw)) {
      return router.createUrlTree(['/home']);
    }
  }

  const plan = (planRaw || '').toLowerCase();
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
