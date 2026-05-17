import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class LotesService {
public url: any;
  private _router: any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

    //   api.get('/lote', auth.auth,lotesController.getAll);
  // api.get('/lote/:idLote',auth.auth, lotesController.getById);
  // api.get('/lotesucursal/:idSucursal',auth.auth, lotesController.getBySucursal);
  // api.post('/lote',auth.auth, lotesController.create);
  // api.put('/lote/:idLote', auth.auth,lotesController.update);
  // api.delete('/lote/:idLote',auth.auth, lotesController.deleted);
  // api.put('/lote/:idLote/disponible',auth.auth, lotesController.actualizarCantidadDisponible);
  
  obtener_lotes_todos(opciones?: { alcanceGestora?: boolean }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    const params: Record<string, string> = {};
    if (opciones?.alcanceGestora) {
      params['alcance'] = 'gestora';
    }
    return this._http.get(this.url + 'lote', {
      headers,
      params,
      withCredentials: true
    });
  }

  obtener_lote_id(idLote:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lote/'+idLote,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_lotes_sucursal(idSucursal:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'lotesucursal/'+idSucursal,{
      headers:headers,
      withCredentials: true
    });
  }

  crear_lote(loteData:any):Observable<any>{
    let params = JSON.stringify(loteData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'lote',params,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_lote(idLote:any,loteData:any):Observable<any>{
    let params = JSON.stringify(loteData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'lote/'+idLote,params,{
      headers:headers,
      withCredentials: true
    });
  }
  eliminar_lote(idLote:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'lote/'+idLote,{
      headers:headers,
      withCredentials: true
    });
  }
  actualizar_cantidad_disponible(idLote:any,cantidadData:any):Observable<any>{
    let params = JSON.stringify(cantidadData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'lote/'+idLote+'/disponible',params,{
      headers:headers,
      withCredentials: true
    });
  }

}
