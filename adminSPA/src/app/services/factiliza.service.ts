import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

@Injectable({
  providedIn: 'root'
})

export class FactilizaService {

  public url: any;

  constructor(private _http: HttpClient) { 
    this.url = global.url;
  }

  getAnexoByRUC(ruc: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/ruc/anexo/${ruc}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getDni(dni: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/dni/${dni}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getCextranjeria(cee: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/cextranjeria/${cee}`,{
      headers: headers,
      withCredentials: true
    });
  }
    
  getRuc(ruc: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/ruc/${ruc}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getTipoCambio(fecha: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/tipocambio/${fecha}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getPlaca(placa: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/placa/${placa}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getSoat(placa: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/soat/${placa}`,{
      headers: headers,
      withCredentials: true
    });
  }

  getLicencia(licencia: string): Observable<any> {
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(`${this.url}/licencia/${licencia}`,{
      headers: headers,
      withCredentials: true
    });
  }

  /////////////////////////////////////////////////////////////////////////////////////////
  // Otros servicios de factiliza
  /////////////////////////////////////////////////////////////////////////////////////////




}
 
