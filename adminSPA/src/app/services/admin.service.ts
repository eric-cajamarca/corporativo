import { Injectable } from '@angular/core';

/** Respuesta de login / pasos 2FA (misma forma al completar sesión). */
export interface AdminLoginUserData {
  idUsuario: string;
  idEmpresa: string;
  razonSocial: string;
  nombres: string;
  apellidos: string;
  email: string;
  rol: string;
  requiresTwoFactor?: boolean;
  requiresTwoFactorSetup?: boolean;
  pendingToken?: string;
}

export interface AdminLoginResponse {
  message: string;
  data: AdminLoginUserData;
}
import { Observable } from 'rxjs';
import { global } from './global.js'; // Asegúrate de que la ruta sea correcta
import { HttpClient, HttpHeaders } from '@angular/common/http';
//import { HttpClientModule } from '@angular/common/http';


//import { CookieService } from 'ngx-cookie-service';


@Injectable({
  providedIn: 'root',
  
})
export class AdminService {

  public url: any;
  private _router: any;
  public idUser: any;
  public idempresa: any;
  
  constructor(
    private _http: HttpClient,
    
  ) {
    this.url = global.url;
  }

  admin_login(data: { email: string; password: string; ruc: string }): Observable<AdminLoginResponse> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post<AdminLoginResponse>(this.url + 'admin_login', data, {
      headers: headers,
      withCredentials: true
    });
  }

  /** Genera QR (data URL) para registrar TOTP; requiere pendingToken del login admin. */
  admin2faSetupInit(pendingToken: string): Observable<{ message: string; data: { qrDataUrl: string } }> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post<{ message: string; data: { qrDataUrl: string } }>(
      this.url + 'admin_2fa_setup_init',
      { pendingToken },
      { headers, withCredentials: true }
    );
  }

  /** Confirma primer código TOTP y abre sesión. */
  admin2faSetupConfirm(pendingToken: string, code: string): Observable<AdminLoginResponse> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post<AdminLoginResponse>(
      this.url + 'admin_2fa_setup_confirm',
      { pendingToken, code },
      { headers, withCredentials: true }
    );
  }

  /** Valida TOTP en login de admin con 2FA ya activo. */
  admin2faVerify(pendingToken: string, code: string): Observable<AdminLoginResponse> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post<AdminLoginResponse>(
      this.url + 'admin_2fa_verify',
      { pendingToken, code },
      { headers, withCredentials: true }
    );
  }

  /** Solicitar recuperación de contraseña (RUC + email). Devuelve token para paso siguiente. */
  recuperarPassword(ruc: string, email: string): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post(this.url + 'recuperar-password', { ruc, email }, { headers });
  }

  /** Restablecer contraseña con el token recibido. */
  restablecerPassword(token: string, newPassword: string): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post(this.url + 'restablecer-password', { token, newPassword }, { headers });
  }

  //api.get('/getEmpresa_login',auth.auth, adminController.getEmpresa_login);
  getEmpresa_login(): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'getEmpresa_login', {
      headers: headers,
      withCredentials: true
    });
  }

  logout():Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    return this._http.post(this.url + 'logout', {}, {
      headers: headers,
      withCredentials: true
    });
    
  }
  
  
  // admin_login(data: any): Observable<any> {
  //   let headers = new HttpHeaders().set('Content-Type', 'application/json');
  //   return this._http.post(this.url + 'admin_login', data, {
    //   headers: headers,
    //   withCredentials: true
    // });
  // }

  // gettoken() {
  //   return localStorage.getItem('token');
  // }



  // public isAuthenticated(allowRoles: string[]): boolean {
  //   const token: any = this.cookieService.get('token'); // Use HttpOnly cookies

  //   if (!token) {
  //     return false;
  //   }

  //   try {
  //     const helper = new JwtHelperService();
  //     var decodedToken = helper.decodeToken(token);

  //     const { nombres, apellidos, empresa } = decodedToken;
  //     this.idUser = { nombres, apellidos, empresa };

  //     if (!decodedToken) {
  //       console.log('token no valido');
  //       this.cookieService.delete('token'); // Use HttpOnly cookies
  //       return false;
  //     }
  //   } catch (error) {
  //     //this.loggerService.error(error); // Log errors
  //     this.cookieService.delete('token'); // Use HttpOnly cookies
  //     return false;
  //   }

  //   return allowRoles.includes(decodedToken['rol']);


    
  // }

  registro_colaborador_admin(data: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.post(this.url + 'admin', data, {
      headers: headers,
      withCredentials: true
    });
  }


  getAdmin(): Observable<any> {

    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'admin', {
      headers: headers,
      withCredentials: true
    });
  }

  cambiar_estado_colaborador_admin(id: any, data: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'cambiar_estado_colaborador_admin/' + id, data, {
      headers: headers,
      withCredentials: true
    });
  }

  obtener_datos_colaborador_admin(id: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'obtener_datos_colaborador_admin/' + id, {
      headers: headers,
      withCredentials: true
    });
  }

  editar_colaborador_admin(id: any, data: any): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'admin/' + id, data, {
      headers: headers,
      withCredentials: true
    });
  }

  get_Regiones():Observable<any>{
    return this._http.get('./assets/regiones.json');
  }

  //quiero buscar Regiones por name
  

  get_Distritos():Observable<any>{
    return this._http.get('./assets/distritos.json');
  }
  get_Procincias():Observable<any>{
    return this._http.get('./assets/provincias.json');
  }

  

}


