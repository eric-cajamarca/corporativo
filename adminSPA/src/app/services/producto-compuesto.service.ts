import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class ProductoCompuestoService {
public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  crear_producto_compuesto(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'compuestos',data,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_componentes(idProductoPadre:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'compuestos/'+idProductoPadre,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_componentes(idProductoPadre:any, data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'compuestos/'+idProductoPadre,data,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_producto_compuesto(idProductoPadre:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'compuestos/'+idProductoPadre,{
      headers:headers,
      withCredentials: true
    });
  }


  calcular_stock_compuesto(idProductoPadre:any, idSucursal?:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    let endpoint = this.url+'compuestos/'+idProductoPadre+'/stock';
    if(idSucursal){
      endpoint += '/'+idSucursal;
    }
    return this._http.get(endpoint,{
      headers:headers,
      withCredentials: true
    });
  }

}