import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class ComprobanteService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // api.get('/comprobantes', auth.auth,comprobantesController.obtener_comprobantes);
  // api.get('/comprobantes/:id', auth.auth,comprobantesController.obtenerComprobantes_alias);

  obtener_comprobantes_alias(id:any):Observable<any>{
    console.log('id',id);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'comprobantes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_comprobantes():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'comprobantes',{
      headers: headers,
      withCredentials: true
    });
  }


}
