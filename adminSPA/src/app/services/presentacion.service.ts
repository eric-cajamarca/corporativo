import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';
import { Comprobante } from '../interfaces/comprobante-interface';
import { ApiResponse } from '../interfaces/ApiResponse-interface';

@Injectable({
  providedIn: 'root'
})
export class PresentacionService {
  public url: any;
  private _router: any;
  public idUser:any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }
  
  // api.get('/presentaciones',auth.auth, presentacionController.obtener_Presentaciones);
  // api.get('/presentaciones/:id',auth.auth, presentacionController.obtener_presentacion_id);
  // api.post('/presentaciones', auth.auth, presentacionController.crear_Presentacion);
  // api.put('/presentaciones/:id',auth.auth, presentacionController.editar_presentacion);
  // api.delete('/presentaciones/:id',auth.auth, presentacionController.eliminar_presentacion);
  
  obtener_presentaciones():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'presentaciones',{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_presentaciones1():Observable<ApiResponse<Comprobante[]>>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get<ApiResponse<Comprobante[]>>(this.url+'presentaciones',{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_presentacion_id(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'presentaciones/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

  crear_presentacion(presentacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'presentaciones',presentacion,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_presentacion(id:any,presentacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'presentaciones/'+id,presentacion,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_presentacion(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'presentaciones/'+id,{
      headers:headers,
      withCredentials: true
    });
  }
  

}
