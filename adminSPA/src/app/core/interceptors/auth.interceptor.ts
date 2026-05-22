// auth.interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const url = req.url;
    const skipRefresh =
      url.includes('refresh_session') ||
      url.includes('session_alive') ||
      url.includes('admin_login') ||
      url.includes('admin_2fa_') ||
      url.includes('logout') ||
      url.includes('recuperar-password') ||
      url.includes('restablecer-password');

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error instanceof HttpErrorResponse && error.status === 403 && !skipRefresh) {
          const msg = error.error?.message;
          if (msg === 'SesionRevocada') {
            this.authService.forceLogout();
            return throwError(() => error);
          }
          if (msg === 'TokenExpirado' || msg === 'InvalidToken' || msg === 'NoTokenError') {
            return this.authService.tryRefreshSession().pipe(
              switchMap(ok => {
                if (!ok) {
                  this.authService.forceLogout();
                  return throwError(() => error);
                }
                return next.handle(req);
              })
            );
          }
        }
        return throwError(() => error);
      })
    );
  }
}
