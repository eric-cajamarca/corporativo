import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProgramacionService {
  public url: any;

  

  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }


  obtener_all_programaciones():Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'programacion',{
      headers:headers,
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
