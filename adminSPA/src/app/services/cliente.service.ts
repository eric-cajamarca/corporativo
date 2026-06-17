import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { global } from './global';
import { Observable, of } from 'rxjs';
import { shareReplay, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {
  public url: any;
  private _router: any;
  public idUser: any;

  private clientesMemoria: { data: unknown[] } | null = null;
  private clientesEnVuelo: Observable<{ data: unknown[] }> | null = null;

  constructor(private _http: HttpClient) {
    this.url = global.url;
  }

  invalidarCacheClientes(): void {
    this.clientesMemoria = null;
    this.clientesEnVuelo = null;
  }

  obtener_clientes(opciones?: { evitarCache?: boolean }): Observable<any> {
    if (!opciones?.evitarCache && this.clientesMemoria != null) {
      return of(this.clientesMemoria);
    }
    if (!opciones?.evitarCache && this.clientesEnVuelo) {
      return this.clientesEnVuelo;
    }
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    const req$ = this._http.get<{ data: unknown[] }>(this.url + 'clientes', { headers, withCredentials: true }).pipe(
      tap((res) => {
        this.clientesMemoria = res;
        this.clientesEnVuelo = null;
      }),
      shareReplay(1)
    );
    this.clientesEnVuelo = req$;
    return req$;
  }

  obtenerClientesPaginado(params: {
    pagina?: number;
    porPagina?: number;
    buscar?: string;
  }): Observable<{ data: unknown[]; total: number }> {
    let q = new HttpParams();
    if (params.pagina != null) q = q.set('pagina', String(params.pagina));
    if (params.porPagina != null) q = q.set('porPagina', String(params.porPagina));
    if (params.buscar) q = q.set('buscar', params.buscar);
    const headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.get<{ data: unknown[]; total: number }>(this.url + 'clientes', {
      headers,
      withCredentials: true,
      params: q
    });
  }

   //Metodo para obtener un cliente por ruc
   obtener_cliente_ruc(id:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'clientesruc/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para obtener un cliente por id
  obtener_cliente_id(id:any):Observable<any>{
        let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'clientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //Metodo para crear un cliente
  crear_cliente(data:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url + 'clientes', data,{
      headers: headers,
      withCredentials: true
    }).pipe(tap(() => this.invalidarCacheClientes()));
    
  }

  //Metodo para editar un cliente
  editar_cliente(id:any,cliente:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'clientes/'+id,cliente,{
      headers: headers,
      withCredentials: true
    }).pipe(tap(() => this.invalidarCacheClientes()));
  }

  //Metodo para eliminar un cliente
  eliminar_cliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'clientes/'+id,{
      headers: headers,
      withCredentials: true
    }).pipe(tap(() => this.invalidarCacheClientes()));
  }


  cambiar_estado_clientes(id: any, data: any): Observable<any> {
        let headers = new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': '' });
    return this._http.put(this.url + 'cambiar_estado_clientes/' + id, data, { headers: headers });
  }
  ////////////////////////////////////////////////////////////////////////////////////////////
  //metodo para obtener direccionCliente
  obtener_direccionCliente_id(id:any):Observable<any>{
    
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para obtener direccionCliente idCLiente
  obtener_direccionesCliente_idCliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.get(this.url+'direccionesClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para crear direccionCliente
  crear_direccionCliente(data:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.post(this.url+'direccionClientes',data,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para editar direccionCliente
  editar_direccionCliente(id:any,direccionCliente:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.put(this.url+'direccionClientes/'+id,direccionCliente,{
      headers: headers,
      withCredentials: true
    });
  }

  //metodo para eliminar direccionCliente 
  eliminar_direccionCliente(id:any):Observable<any>{
    let headers = new HttpHeaders({'Content-Type':'application/json','Authorization':''});
    return this._http.delete(this.url+'direccionClientes/'+id,{
      headers: headers,
      withCredentials: true
    });
  }



}
