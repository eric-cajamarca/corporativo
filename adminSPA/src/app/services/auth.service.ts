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
  share
} from 'rxjs';
import { global } from './global';

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
  private verificationInterval = 10 * 60 * 1000; // Verificar cada 15 minutos

  /** Una sola petición refresh en vuelo (evita tormenta si expiran muchas llamadas a la vez). */
  private refreshInFlight$: Observable<boolean> | null = null;

  // Rutas públicas que NO requieren autenticación
  private readonly publicRoutes = [
    '/login-empresa',
    '/crear-empresa',
    '/verificar-empresa'
  ];

  // Exponer datos reactivos
  userData = this._userData.asReadonly();
  isAuthenticated = computed(() => !!this._userData());
  public url: any;
  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.url = global.url;
  }

  /**
   * Verifica si la ruta actual es pública
   */
  private isPublicRoute(): boolean {
    const currentUrl = this.router.url;
    return this.publicRoutes.some(route => currentUrl.includes(route));
  }

  initialize() {
    this.verifyToken().subscribe();
    this.setupTokenVerification();
  }

  private setupTokenVerification() {
    // setInterval(() => {
    //   this.verifyToken().subscribe();
    // }, this.verificationInterval);
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
    this._userData.set({
      idEmpresa: data.idEmpresa ?? null,
      razonSocial: data.razonSocial || '',
      nombres:
        data.nombres || data.apellidos
          ? `${data.nombres || ''} ${data.apellidos || ''}`.trim()
          : 'Usuario',
      rol: data.rol || '',
      lastVerified: Date.now()
    });
  }

  private handleAuthResponse(response: any) {
    if (response?.active === true && response?.data) {
      const d = response.data;
      this._userData.set({
        idEmpresa: d.idEmpresa ?? null,
        razonSocial: d.razonSocial || '',
        nombres: d.nombres || '',
        rol: d.roles ?? d.rol ?? '',
        lastVerified: Date.now()
      });
    } else {
      this._userData.set(null);
      if (!this.isPublicRoute()) {
        this.router.navigate(['/login-empresa']);
      }
    }
  }

  private handleAuthError() {
    this._userData.set(null);
    if (!this.isPublicRoute()) {
      this.router.navigate(['/login-empresa']);
    }
  }

  forceLogout() {
    this.http.post(this.url + 'logout', {}, { withCredentials: true }).subscribe({
      complete: () => {
        this._userData.set(null);
        this.router.navigate(['/login-empresa']);
        this.verifyToken().subscribe();
      }
    });
  }
}
