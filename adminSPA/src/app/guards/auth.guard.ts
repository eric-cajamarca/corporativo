// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { isPublicUrl } from '../core/constants/public-routes';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const url = state.url || '';

    // #region agent log
    fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'auth.guard.ts:canActivate',message:'guard entry',data:{url,isPublic:isPublicUrl(url)},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion

    if (isPublicUrl(url)) {
      return of(true);
    }

    const isLoginRoute = url.includes('/login-empresa');

    return this.authService.verifyToken().pipe(
      map(isValid => {
        if (isValid && isLoginRoute) {
          // #region agent log
          fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'auth.guard.ts:redirectHome',message:'redirect to home from login',data:{url,isValid},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          this.router.navigate(['/home']);
          return false;
        }

        if (!isValid && !isLoginRoute) {
          // #region agent log
          fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'auth.guard.ts:redirectLogin',message:'redirect to login',data:{url,isValid},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          this.router.navigate(['/login-empresa']);
          return false;
        }

        return true;
      })
    );
  }
}
