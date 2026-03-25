
import { Injectable } from '@angular/core';
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

  admin_login(data: any): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json');
    //Usar withCredentials: true para que se incluyan cookies
            return this._http.post(this.url + 'admin_login', data, {
      headers: headers,
      withCredentials: true
    });
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


