import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CategoriaService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // api.get('/categorias',auth.auth, categoriaController.obtener_Categorias);
  // api.get('/categoriasempresa',auth.auth, categoriaController.obtener_Categorias_idEmpresa);
  // api.get('/categorias/:id',auth.auth, categoriaController.obtener_Categoria_id);
  // api.get('/categoriasempresa/:id',auth.auth, categoriaController.obtener_Categoria_id_idempresa);
  // api.post('/categorias', auth.auth, categoriaController.crear_Categoria);
  // api.put('/categorias/:id',auth.auth, categoriaController.editar_Categoria);
  // api.delete('/categorias/:id',auth.auth, categoriaController.eliminar_Categoria);

  obtener_categorias():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'categorias',{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_categorias_idEmpresa(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'categoriasempresa/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_categoria_id(id:any,token:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'categorias/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  obtener_categoria_id_idempresa(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'categoriasempresa/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  crear_categoria(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'categorias', data,{
      headers: headers,
      withCredentials: true
    });
    
  }

  editar_categoria(id:any,categoria:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'categorias/'+id,categoria,{
      headers: headers,
      withCredentials: true
    });
  }

  eliminar_categoria(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'categorias/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //api.put('/cambiar_estado/:id',auth.auth, categoriaController.cambiar_estado_categoria);
  cambiar_estado_categoria(id:any,estado:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'cambiar_estado/'+id,{estado},{
      headers: headers,
      withCredentials: true
    });
  }
  
}
