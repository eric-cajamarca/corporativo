import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PreciosService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  

  //quiero crear los servicios para la siguiente rutas
  // api.post('/lista_precios',auth.auth, preciosVController.crear_lista_precio);
  // api.put('/lista_precios/:id',auth.auth, preciosVController.editar_lista_precio);
  // api.get('/lista_precios',auth.auth, preciosVController.obtener_listas_precio_producto);
  // api.delete('/lista_precios/:id',auth.auth, preciosVController.desactivar_lista_precio);
  // api.post('/precio_producto',auth.auth, preciosVController.crear_precio_producto);
  // api.put('/precio_producto/:id',auth.auth, preciosVController.editar_precio_producto);
  // api.get('/precio_producto/:productoId',auth.auth, preciosVController.obtener_precios_producto);
  // api.delete('/precio_producto/:id',auth.auth, preciosVController.eliminar_precio_producto);

  listar_listas_precios_producto():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lista_precios',{withCredentials:true,headers:headers});
  }

  //api.get('/lista_precios_empresa',auth.auth, preciosVController.obtener_listas_precio_empresa);
  listar_listas_precios_empresa():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lista_precios_empresa',{withCredentials:true,headers:headers});
  }

  listar_precios_producto(productoId:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'precio_producto/'+productoId,{withCredentials:true,headers:headers});
  }

  crear_lista_precios(data:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'lista_precios',data,{withCredentials:true,headers:headers});
  }

  editar_lista_precios(id:any,data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'lista_precios/'+id,data,{withCredentials:true,headers:headers});
  }

  desactivar_lista_precios(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'lista_precios/'+id,{withCredentials:true,headers:headers});
  }

  creaer_precio_producto(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'precio_producto',data,{withCredentials:true,headers:headers});
  }

  editar_precio_producto(id:any,data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'precio_producto/'+id,data,{withCredentials:true,headers:headers});
  }

  


}
