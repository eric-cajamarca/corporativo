import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class LotesUbicacionService {
public url: any;
  private _router: any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  //   api.get('/lote-ubicacion/lote/:idLote', lotesUbicacionController.getByLote);
  // api.get('/lote-ubicacion/ubicacion/:idUbicacion', lotesUbicacionController.getByUbicacion);
  // api.post('/lote-ubicacion', lotesUbicacionController.create);
  // api.put('/lote-ubicacion', lotesUbicacionController.updateCantidad);
  // api.delete('/lote-ubicacion/:idLote/:idUbicacion', lotesUbicacionController.deleted);

  obtener_ubicacionLote_idLote(idLote:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lote-ubicacion/lote/'+idLote,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_ubicacionLote_idUbicacion(idUbicacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lote-ubicacion/ubicacion/'+idUbicacion,{
      headers:headers,
      withCredentials: true
    });
  }

  crear_loteUbicacion(loteUbicacionData:any):Observable<any>{
    let params = JSON.stringify(loteUbicacionData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'lote-ubicacion',params,{
      headers:headers,
      withCredentials: true
    });
  }
  actualizar_cantidad_loteUbicacion(loteUbicacionData:any):Observable<any>{
    let params = JSON.stringify(loteUbicacionData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'lote-ubicacion',params,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_loteUbicacion(idLote:any, idUbicacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'lote-ubicacion/'+idLote+'/'+idUbicacion,{
      headers:headers,
      withCredentials: true
    });
  }
}
