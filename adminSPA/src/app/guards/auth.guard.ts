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

    if (isPublicUrl(url)) {
      return of(true);
    }

    const isLoginRoute = url.includes('/login-empresa');

    return this.authService.verifyToken().pipe(
      map(isValid => {
        if (isValid && isLoginRoute) {
          this.router.navigate(['/home']);
          return false;
        }

        if (!isValid && !isLoginRoute) {
          this.router.navigate(['/login-empresa']);
          return false;
        }

        return true;
      })
    );
  }
}
