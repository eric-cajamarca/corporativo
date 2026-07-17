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
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { ConnectionTimerService } from '../../services/connection-timer.service';
import { environment } from '../../../environments/environment';
import { fechaHoraVentaClienteAhora } from '../../utils/fecha-local.util';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private authService: AuthService,
    private connectionTimer: ConnectionTimerService
  ) {}

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

    const startedAt = Date.now();
    const shouldTrack =
      this.connectionTimer.isActive() &&
      !skipRefresh &&
      (url.includes(environment.API_URL) || url.includes(environment.PDF_API_BASE));

    // Marca de tiempo del navegador para auditoría / operaciones (no reloj del servidor).
    const esApiApp = url.includes(environment.API_URL);
    const esMutacion = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const reqConFecha =
      esApiApp && esMutacion && !req.headers.has('X-Fecha-Hora-Cliente')
        ? req.clone({ setHeaders: { 'X-Fecha-Hora-Cliente': fechaHoraVentaClienteAhora() } })
        : req;

    return next.handle(reqConFecha).pipe(
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
                return next.handle(reqConFecha);
              })
            );
          }
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (shouldTrack) {
          this.connectionTimer.addDuration(Date.now() - startedAt);
        }
      })
    );
  }
}
