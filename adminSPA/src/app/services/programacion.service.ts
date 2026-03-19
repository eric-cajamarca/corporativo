import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

export interface FiltrosProgramacion {
  idEstado?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  ruc?: string;
  cliente?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProgramacionService {
  public url: any;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  obtener_all_programaciones(filtros?: FiltrosProgramacion): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    let params: Record<string, string> = {};
    if (filtros) {
      if (filtros.idEstado != null) params['idEstado'] = String(filtros.idEstado);
      if (filtros.fechaDesde) params['fechaDesde'] = filtros.fechaDesde;
      if (filtros.fechaHasta) params['fechaHasta'] = filtros.fechaHasta;
      if (filtros.ruc) params['ruc'] = filtros.ruc;
      if (filtros.cliente) params['cliente'] = filtros.cliente;
    }
    return this._http.get(this.url + 'programacion', {
      headers,
      params,
      withCredentials: true
    });
  }

  obtener_programaciones_id(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'programacion/'+id,{
      headers:headers,
      withCredentials: true
    });
  }

}
