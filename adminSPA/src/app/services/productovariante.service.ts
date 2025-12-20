import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';


@Injectable({
  providedIn: 'root'
})
export class ProductovarianteService {
public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  crear_atributo(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'atributos',data,{
      headers:headers,
      withCredentials: true
    });
  }

  agregar_valor_atributo(idAtributo:any, data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'atributos/'+idAtributo+'/valores',data,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_atributos_empresa():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'atributos',{
      headers:headers,
      withCredentials: true
    });
  }

  crear_variante(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'variantes',data,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_variantes_producto(idProductoBase:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'productos/'+idProductoBase+'/variantes',{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_variante_por_id(idVariante:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'variantes/'+idVariante,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_variante(idVariante:any, data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'variantes/'+idVariante,data,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_variante(idVariante:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'variantes/'+idVariante,{
      headers:headers,
      withCredentials: true
    });
  }



}
