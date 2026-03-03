// auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, map, of } from 'rxjs';
import { global } from './global';

interface UserData {
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

  verifyToken() {
    return this.http.get<any>(this.url + 'getEmpresa_login', { withCredentials: true }).pipe(
      tap(response => this.handleAuthResponse(response)),
      map(response => response?.active === true),
      catchError(error => {
        console.error('verifyToken error:', error?.status, error?.message);
        this.handleAuthError();
        return of(false);
      })
    );
  }

  /**
   * Establece los datos del usuario desde la respuesta del login (sin llamar al backend).
   * Usar después de login exitoso para evitar verificar token en el mismo tick (cookie puede no estar lista).
   */
  setUserDataFromLogin(data: { razonSocial?: string; nombres?: string; apellidos?: string; rol?: string }) {
    if (!data) return;
    this._userData.set({
      razonSocial: data.razonSocial || '',
      nombres: data.nombres || data.apellidos ? `${data.nombres || ''} ${data.apellidos || ''}`.trim() : 'Usuario',
      rol: data.rol || '',
      lastVerified: Date.now()
    });
    console.log('Usuario establecido desde login:', this._userData());
  }

//   getEmpresa_login(): Observable<any> {
//     const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
//     return this._http.get(this.url + 'getEmpresa_login', {
//       headers: headers,
//       withCredentials: true
//     });
//   }

  private handleAuthResponse(response: any) {
    if (response?.active === true && response?.data) {
      const d = response.data;
      this._userData.set({
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
    console.log('Error al verificar el token');
    this._userData.set(null);
    // Solo redirigir a login si NO estamos en una ruta pública
    if (!this.isPublicRoute()) {
      console.log('Redirigiendo a login desde ruta privada');
      this.router.navigate(['/login-empresa']);
    } else {
      console.log('Estamos en ruta pública, no redirigir a login');
    }
  }

  forceLogout() {
    console.log('Logout forzado desde el backend', this.url);
    this.http.post(this.url + 'logout',{},{ withCredentials: true }).subscribe({
      complete: () => {
        console.log('Logout forzado');
        this._userData.set(null);
        this.router.navigate(['/login-empresa']);
        this.verifyToken().subscribe();
      }
    });
  }
}