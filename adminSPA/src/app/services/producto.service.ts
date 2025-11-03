import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {
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

  obtener_productos_id(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'productos/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

  crear_producto(producto:any):Observable<any>{
    console.log('producto',producto);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'productos',producto,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_producto(id:any,producto:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'productos/'+id,producto,{
      headers:headers,
      withCredentials: true
    });
  }

  //api.delete('/productos/:id',auth.auth, productosController.eliminar_producto);
  eliminar_producto(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'productos/'+id,{
      headers:headers,
      withCredentials: true
    });
  }
  
}
