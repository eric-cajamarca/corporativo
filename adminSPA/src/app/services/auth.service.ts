// auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap, EMPTY } from 'rxjs';
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
    return this.http.get<any>( this.url + 'getEmpresa_login', {withCredentials: true }).pipe(
      
      tap(response => this.handleAuthResponse(response)),
      
      catchError(error => {
        this.handleAuthError();
        return EMPTY;
      })
    );

  }

//   getEmpresa_login(): Observable<any> {
//     const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
//     return this._http.get(this.url + 'getEmpresa_login', {
//       headers: headers,
//       withCredentials: true
//     });
//   }

  private handleAuthResponse(response: any) {
    console.log('handleAuthResponse', response);
    if (response.data) {
      this._userData.set({
        razonSocial: response.data.razonSocial,
        nombres: response.data.nombres,
        rol: response.data.roles,
        lastVerified: Date.now()
      });
      console.log('Usuario conectado:', this._userData());
    } else {
      this._userData.set(null);
      this.router.navigate(['/login-empresa']);
        console.log('No hay empresa conectada','en handleAuthResponse');
    }
  }

  private handleAuthError() {
    console.log('Error al verificar el token, redirigiendo a login','en handleAuthError');
    this._userData.set(null);
    this.router.navigate(['/login-empresa']);
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