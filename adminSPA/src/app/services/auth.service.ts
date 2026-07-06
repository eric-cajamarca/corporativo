// auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  tap,
  map,
  of,
  switchMap,
  finalize,
  share,
  filter,
  take
} from 'rxjs';
import { NavigationEnd } from '@angular/router';
import { global } from './global';
import { ConnectionTimerService } from './connection-timer.service';
import { isPublicBrowserLocation, isPublicUrl } from '../core/constants/public-routes';

interface UserData {
  /** Empresa del JWT (multiempresa). */
  idEmpresa?: string | null;
  razonSocial: string;
  nombres: string;
  rol: string;
  lastVerified: number; // timestamp de última verificación
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private _userData = signal<UserData | null>(null);
  /** Comprueba si la sesión sigue activa en el servidor (p. ej. tras cerrarla en otro dispositivo). */
  private verificationInterval = 60 * 1000;

  /** Una sola petición refresh en vuelo (evita tormenta si expiran muchas llamadas a la vez). */
  private refreshInFlight$: Observable<boolean> | null = null;

  // Exponer datos reactivos
  userData = this._userData.asReadonly();
  isAuthenticated = computed(() => !!this._userData());
  public url: any;
  constructor(
    private http: HttpClient,
    private router: Router,
    private connectionTimer: ConnectionTimerService
  ) {
    this.url = global.url;
  }

  /**
   * Verifica si la ruta actual es pública.
   * En el arranque `router.url` puede ser '' o '/' antes de la primera navegación; se usa también `location`.
   */
  private isPublicRoute(): boolean {
    const browserPublic = isPublicBrowserLocation();
    const routerPublic = isPublicUrl(this.router.url);
    const result = browserPublic || routerPublic;
    // #region agent log
    fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'auth.service.ts:isPublicRoute',message:'public route check',data:{browserPublic,routerPublic,result,routerUrl:this.router.url,browserPath:globalThis.location?.pathname},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    return result;
  }

  initialize() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      take(1)
    ).subscribe((event) => {
      const isPublic = this.isPublicRoute();
      // #region agent log
      fetch('http://127.0.0.1:7846/ingest/a2bad43c-6b04-4aa9-9882-ff32cc25e5d5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'acf3ea'},body:JSON.stringify({sessionId:'acf3ea',location:'auth.service.ts:initialize',message:'first NavigationEnd',data:{url:event.url,urlAfterRedirects:event.urlAfterRedirects,isPublic,willVerifyToken:!isPublic},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (!isPublic) {
        this.verifyToken().subscribe();
      }
    });
    this.setupTokenVerification();
  }

  private setupTokenVerification() {
    setInterval(() => {
      if (!this.isAuthenticated() || this.isPublicRoute()) return;
      this.http
        .get<{ message: string }>(this.url + 'session_alive', { withCredentials: true })
        .pipe(
          catchError((err) => {
            const msg = err?.error?.message;
            if (msg === 'SesionRevocada' || msg === 'TokenExpirado' || msg === 'InvalidToken') {
              this.forceLogout();
            } else {
              this.handleAuthError();
            }
            return of(null);
          })
        )
        .subscribe();
    }, this.verificationInterval);
  }

  /**
   * Renueva access token vía cookie refresh (HttpOnly).
   */
  tryRefreshSession(): Observable<boolean> {
    if (!this.refreshInFlight$) {
      this.refreshInFlight$ = this.http
        .post<{ success?: boolean }>(this.url + 'refresh_session', {}, { withCredentials: true })
        .pipe(
          map(() => true),
          catchError(() => of(false)),
          finalize(() => {
            this.refreshInFlight$ = null;
          }),
          share()
        );
    }
    return this.refreshInFlight$;
  }

  verifyToken(): Observable<boolean> {
    return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
      switchMap(response => {
        if (response?.active === true && response?.data) {
          this.handleAuthResponse(response);
          return of(true);
        }
        return this.tryRefreshSession().pipe(
          switchMap(ok => {
            if (!ok) {
              this.handleAuthError();
              return of(false);
            }
            return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
              tap(r2 => this.handleAuthResponse(r2)),
              map(r2 => r2?.active === true)
            );
          })
        );
      }),
      catchError(() =>
        this.tryRefreshSession().pipe(
          switchMap(ok => {
            if (!ok) {
              this.handleAuthError();
              return of(false);
            }
            return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
              tap(r2 => this.handleAuthResponse(r2)),
              map(r2 => r2?.active === true)
            );
          })
        )
      )
    );
  }

  /**
   * Comprueba sesión sin redirigir a login (ruta raíz, landing pública).
   */
  peekSession(): Observable<boolean> {
    return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
      switchMap((response) => {
        if (response?.active === true && response?.data) {
          this.setUserData(this.mapSessionUserData(response.data));
          return of(true);
        }
        return this.tryRefreshSession().pipe(
          switchMap((ok) => {
            if (!ok) {
              this.setUserData(null);
              return of(false);
            }
            return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
              map((r2) => {
                if (r2?.active === true && r2?.data) {
                  this.setUserData(this.mapSessionUserData(r2.data));
                  return true;
                }
                this.setUserData(null);
                return false;
              })
            );
          })
        );
      }),
      catchError(() =>
        this.tryRefreshSession().pipe(
          switchMap((ok) => {
            if (!ok) {
              this.setUserData(null);
              return of(false);
            }
            return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
              map((r2) => {
                if (r2?.active === true && r2?.data) {
                  this.setUserData(this.mapSessionUserData(r2.data));
                  return true;
                }
                this.setUserData(null);
                return false;
              }),
              catchError(() => {
                this.setUserData(null);
                return of(false);
              })
            );
          }),
          catchError(() => {
            this.setUserData(null);
            return of(false);
          })
        )
      )
    );
  }

  /**
   * Nombre visible en sidebar/topnav (nombres + apellidos, o razón social de respaldo).
   */
  private buildDisplayName(data: {
    nombres?: string;
    apellidos?: string;
    razonSocial?: string;
  }): string {
    const full = [data.nombres, data.apellidos]
      .filter((x) => x != null && String(x).trim() !== '')
      .join(' ')
      .trim();
    if (full) return full;
    const rs = String(data.razonSocial || '').trim();
    if (rs) return rs;
    return 'Usuario';
  }

  private mapSessionUserData(d: {
    idEmpresa?: string | null;
    razonSocial?: string;
    nombres?: string;
    apellidos?: string;
    rol?: string;
    roles?: string;
  }): UserData {
    return {
      idEmpresa: d.idEmpresa ?? null,
      razonSocial: d.razonSocial || '',
      nombres: this.buildDisplayName(d),
      rol: d.roles ?? d.rol ?? '',
      lastVerified: Date.now()
    };
  }

  /**
   * Establece los datos del usuario desde la respuesta del login (sin llamar al backend).
   * Usar después de login exitoso para evitar verificar token en el mismo tick (cookie puede no estar lista).
   */
  setUserDataFromLogin(data: {
    idEmpresa?: string;
    razonSocial?: string;
    nombres?: string;
    apellidos?: string;
    rol?: string;
  }) {
    if (!data) return;
    this.setUserData(this.mapSessionUserData(data));
  }

  private handleAuthResponse(response: any) {
    if (response?.active === true && response?.data) {
      const d = response.data;
      this.setUserData(this.mapSessionUserData(d));
    } else {
      this.setUserData(null);
      if (!this.isPublicRoute()) {
        this.router.navigate(['/login-empresa']);
      }
    }
  }

  private handleAuthError() {
    this.setUserData(null);
    if (!this.isPublicRoute()) {
      this.router.navigate(['/login-empresa']);
    }
  }

  forceLogout() {
    this.http.post(this.url + 'logout', {}, { withCredentials: true }).subscribe({
      complete: () => {
        this.setUserData(null);
        if (!this.isPublicRoute()) {
          this.router.navigate(['/login-empresa']);
        }
      }
    });
  }

  private setUserData(next: UserData | null): void {
    const wasAuthenticated = !!this._userData();
    const isAuthenticated = !!next;
    this._userData.set(next);

    if (!wasAuthenticated && isAuthenticated) {
      this.connectionTimer.startSession();
    }

    if (wasAuthenticated && !isAuthenticated) {
      this.connectionTimer.stopSession();
    }
  }
}
