import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from '../services/global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class RolService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  obtener_roles():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'rol/',{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_rol_id(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'rol/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //crea el sercicio actualizar_rol
  actualizar_rol(id:any,data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'rol/'+id,data,{
      headers: headers,
      withCredentials: true
    });
  }

  //crea el servicio crear_rol
  crear_rol(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'rol/',data,{
      headers: headers,
      withCredentials: true
    });
  }

}
