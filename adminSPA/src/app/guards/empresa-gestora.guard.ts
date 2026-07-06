import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { EmpresaService } from '../services/empresa.service';
import { map, catchError, of } from 'rxjs';

function normalizePath(url: string): string {
  return url.split('?')[0].replace(/^\//, '') || '';
}

/** Rutas que la empresa gestora puede usar aunque el menú esté reducido. */
function esRutaPermitidaGestora(path: string): boolean {
  if (!path || path === 'home') return true;
  if (path === 'editar-empresa') return true;
  if (path === 'empresa') return true;
  if (path === 'analisis') return true;
  if (path.startsWith('ventas/rapida')) return false;
  if (path.startsWith('ventas')) return true;
  if (path.startsWith('cotizaciones')) return true;
  if (path === 'caja' || path.startsWith('caja/')) {
    return true;
  }
  if (path === 'creditos' || path.startsWith('creditos/')) {
    return true;
  }
  if (path.startsWith('despachos')) return true;
  if (path.startsWith('envios')) return true;
  /** Inventario (stock, conteo físico, kardex, movimientos, etc.) */
  if (path.startsWith('inventario')) return true;
  /** Colaboradores y roles de la propia empresa gestora (JWT = idEmpresa gestora). */
  if (path.startsWith('colaborador')) return true;
  if (path.startsWith('rol')) return true;
  if (path.startsWith('sucursal')) return true;
  if (path === 'configuracion' || path.startsWith('configuracion/')) return true;
  return false;
}

export const empresaGestoraGuard: CanActivateFn = (_route, state) => {
  const empresaService = inject(EmpresaService);
  const router = inject(Router);
  const path = normalizePath(state.url);

  return empresaService.getEstadoConfiguracion().pipe(
    map((res) => {
      const esGestora = res?.data?.esGestora === true;
      if (!esGestora) return true;
      if (esRutaPermitidaGestora(path)) return true;
      // #region agent log
      fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'empresa-gestora.guard.ts:home',message:'gestora guard redirect home',data:{path,url:state.url},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      return router.createUrlTree(['/home']);
    }),
    catchError(() => of(true))
  );
};
