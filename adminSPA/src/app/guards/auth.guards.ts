// auth.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { map } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    return this.authService.verifyToken().pipe(
      map(isValid => {
        const isLoginRoute = state.url.includes('/empresa-login');
        
        // Si el token es válido y está en la página de login, redirigir a home
        if (isValid && isLoginRoute) {
          this.router.navigate(['/home']);
          return false;
        }
        
        // Si el token no es válido y no está en la página de login, redirigir a login
        if (!isValid && !isLoginRoute) {
          console.log('Token no válido, redirigiendo a login');
          this.router.navigate(['/empresa-login']);
          return false;
        }
        
        // Permitir acceso en otros casos válidos
        return true;
      })
    );
  }
}





















// import { Injectable } from '@angular/core';
// import { CanActivate, Router } from '@angular/router';

// import { map } from 'rxjs/operators';
// import { AuthService } from '../services/auth.service';

// @Injectable({
//   providedIn: 'root'
// })
// export class AuthGuard implements CanActivate {
//   constructor(
//     private authService: AuthService,
//     private router: Router
//   ) {}

//   canActivate() {
//     return this.authService.verifyToken().pipe(
//       map(isValid => {
//         if (!isValid) {
//             console.log('Token no válido, redirigiendo a login');
//           this.router.navigate(['/empresa-login']);
//           return false;
//         }
       
//         return true;
//       })
//     );
//   }
// }