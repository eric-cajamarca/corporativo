import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class TransferenciaService {
public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  obtener_productos_todos():Observable<any>{
      let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
      return this._http.get(this.url+'productos',{
        headers:headers,
        withCredentials: true
      });
  }


  crear_transferencia(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'transferencias',data,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_transferencias():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'transferencias',{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_transferencia_por_id(idMovimiento:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'transferencias/'+idMovimiento,{
      headers:headers,
      withCredentials: true
    });
  }

  revertir_transferencia(idMovimiento:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'transferencias/'+idMovimiento+'/revertir',{},{
      headers:headers,
      withCredentials: true
    });
  }


  verificar_stock_transferencia(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'transferencias/verificar-stock',data,{
      headers:headers,
      withCredentials: true
    });
  }





}
