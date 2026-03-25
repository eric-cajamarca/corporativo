import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class CventaService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  obtener_datos_cventas(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'cventas/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_datos_cventas_empresa(id:any, aliasempresa:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url + `cventas/${id}/${aliasempresa}`, { 
      headers: headers,
      withCredentials: true
     });
  }

}
