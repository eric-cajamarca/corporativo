import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})
export class UbicacionPrioridadService {
  public url: any;
  private _router: any;
  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }

  // api.get('/ubicaciones-prioridad',auth.auth, ubicacionesPrioridadController.getAll);
  // api.get('/ubicaciones-prioridad/sucursal/:idSucursal',auth.auth, ubicacionesPrioridadController.getBySucursal);
  // api.post('/ubicaciones-prioridad',auth.auth, ubicacionesPrioridadController.create);
  // api.put('/ubicaciones-prioridad/:idUbicacion',auth.auth, ubicacionesPrioridadController.update);
  // api.delete('/ubicaciones-prioridad/:idUbicacion',auth.auth, ubicacionesPrioridadController.deleted);

 obtener_ubicacionesPrioridad_todos():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'ubicaciones-prioridad',{
      headers:headers,
      withCredentials: true
    });
  }
 
  obtener_ubicacionesPrioridad_sucursal(idSucursal:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'ubicaciones-prioridad/sucursal/'+idSucursal,{
      headers:headers,
      withCredentials: true
    });
  }

  obtener_codigos_ubicacion_consolidados(opciones?: {
    idEmpresa?: string | null;
    modo?: 'interseccion' | 'union';
  }): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', Authorization: '' });
    const params: Record<string, string> = {};
    if (opciones?.idEmpresa?.trim()) {
      params['idEmpresa'] = opciones.idEmpresa.trim();
    } else if (opciones?.modo === 'union') {
      params['modo'] = 'union';
    }
    return this._http.get(this.url + 'ubicaciones-prioridad/codigos-consolidados', {
      headers,
      params,
      withCredentials: true
    });
  }

  crear_ubicacionPrioridad(ubicacionPrioridadData:any):Observable<any>{
    let params = JSON.stringify(ubicacionPrioridadData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'ubicaciones-prioridad',params,{
      headers:headers,
      withCredentials: true
    });
  }

  actualizar_ubicacionPrioridad(idUbicacion:any, ubicacionPrioridadData:any):Observable<any>{
    let params = JSON.stringify(ubicacionPrioridadData);
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'ubicaciones-prioridad/'+idUbicacion,params,{
      headers:headers,
      withCredentials: true
    });
  }

  eliminar_ubicacionPrioridad(idUbicacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'ubicaciones-prioridad/'+idUbicacion,{
      headers:headers,
      withCredentials: true
    });
  }


}
