
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { global } from './global';
//import { JwtHelperService } from '@auth0/angular-jwt';


@Injectable({
  providedIn: 'root'
})
export class DespachoSerciceService {
  public url: any;
  private _router: any;
  public idUser:any;
  private datosCompartidos:any = {};

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  
  obtener_datos_envios():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/',{headers:headers});
  }

  obtener_datos_envios_id(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'envios/'+id,{headers:headers});
  }

  
  registro_compEnvio(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'envios',data,{headers:headers});
  }


  
 


}
