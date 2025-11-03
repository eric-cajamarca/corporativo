import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable } from 'rxjs/internal/Observable';

@Injectable({
  providedIn: 'root'
})
export class TablasSunatService {
  public url: any;
  private _router: any;
  public idUser: any;


  constructor(
    private _http: HttpClient,
  ) {
    this.url = global.url;
  }



 

  //   api.get('/estadopago',auth.auth, tablasSunatController.obtener_estado_pago);
  // api.get('/mediospago',auth.auth, tablasSunatController.obtener_medios_pago);
  // api.get('/estadosunat',auth.auth, tablasSunatController.obtener_estado_sunat);
  // api.get('/moneda',auth.auth, tablasSunatController.obtener_moneda);
  // api.get('/leyenda',auth.auth, tablasSunatController.obtener_leyenda);
  // api.get('/tipodoc',auth.auth, tablasSunatController.obtener_tipo_doc);
  // api.get('/tipooperacion',auth.auth, tablasSunatController.obtener_tipo_operacion);
  // api.get('/modalidadtraslado',auth.auth, tablasSunatController.obtener_modalidad_traslado);
  // api.get('/motivostraslado',auth.auth, tablasSunatController.obtener_motivos_traslado);
  // api.get('/tipofactura',auth.auth, tablasSunatController.obtener_tipo_factura);
  // api.get('/regimenpercepcion',auth.auth, tablasSunatController.obtener_regimen_percepcion);
  // api.get('/regimenretencion',auth.auth, tablasSunatController.obtener_regimen_retencion);
  // api.get('/tributos',auth.auth, tablasSunatController.obtener_tributos);

  obtener_estado_pago(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'estadopago', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_medios_pago(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'mediospago', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_estado_sunat(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'estadosunat', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_moneda(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'moneda', { 
       headers: headers,
      withCredentials: true
     });
  }
  
  obtener_leyenda(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'leyenda', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_tipo_doc(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'tipodoc', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_tipo_operacion(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'tipooperacion', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_modalidad_traslado(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'modalidadtraslado', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_motivos_traslado(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + 'motivostraslado', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_tipo_factura(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url + '/tipofactura', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_regimen_percepcion(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get(this.url +'regimenpercepcion', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_regimen_retencion(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get( this.url +'regimenretencion', { 
       headers: headers,
      withCredentials: true
     });
  }

  obtener_tributos(): Observable<any> {
    let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get( this.url +'tributos', { 
       headers: headers,
      withCredentials: true
     });
  }


}