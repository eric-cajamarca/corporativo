import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/internal/Observable';
import { global } from './global';

export interface ProductoTrasladoUbicacion {
  idProducto: string;
  idEmpresa: string;
  codigoProducto: string;
  nombreProducto: string;
  marca?: string;
  categoria?: string;
  stockEnUbicaciones: number;
  aliasEmpresa?: string;
}

export interface LoteTrasladable {
  idLote: string;
  idProducto: string;
  idSucursal: string;
  numeroLote?: string;
  cantidadDisponible: number;
  nombreSucursal?: string;
  stockEnUbicaciones: number;
}

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

  buscarProductosTraslado(params: {
    buscar?: string | null;
    idSucursal?: string | null;
    restringirSucursal?: boolean;
  }): Observable<{ success: boolean; items: ProductoTrasladoUbicacion[]; alcanceGestora?: boolean }> {
    let hp = new HttpParams();
    if (params.buscar?.trim()) {
      hp = hp.set('buscar', params.buscar.trim());
    }
    if (params.idSucursal?.trim()) {
      hp = hp.set('idSucursal', params.idSucursal.trim());
    }
    if (params.restringirSucursal === false) {
      hp = hp.set('restringirSucursal', 'false');
    }
    return this._http.get<{ success: boolean; items: ProductoTrasladoUbicacion[] }>(
      this.url + 'lote-ubicacion/buscar-productos',
      { params: hp, withCredentials: true }
    );
  }

  listarLotesTrasladables(
    idProducto: string,
    idSucursal?: string | null,
    restringirSucursal = true
  ): Observable<{ success: boolean; lotes: LoteTrasladable[]; idEmpresa: string }> {
    let hp = new HttpParams();
    if (idSucursal?.trim()) {
      hp = hp.set('idSucursal', idSucursal.trim());
    }
    if (!restringirSucursal) {
      hp = hp.set('restringirSucursal', 'false');
    }
    return this._http.get<{ success: boolean; lotes: LoteTrasladable[]; idEmpresa: string }>(
      this.url + 'lote-ubicacion/producto/' + idProducto + '/lotes',
      { params: hp, withCredentials: true }
    );
  }

  trasladoEntreUbicaciones(body: {
    idLote: string;
    idUbicacionOrigen: number;
    idUbicacionDestino: number;
    cantidad: number;
  }): Observable<{ success: boolean; message: string }> {
    return this._http.post<{ success: boolean; message: string }>(
      this.url + 'lote-ubicacion/trasladar',
      body,
      { withCredentials: true }
    );
  }

  eliminar_loteUbicacion(idLote:any, idUbicacion:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'lote-ubicacion/'+idLote+'/'+idUbicacion,{
      headers:headers,
      withCredentials: true
    });
  }
}
